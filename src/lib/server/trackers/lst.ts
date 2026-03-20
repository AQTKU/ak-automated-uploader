import type { FieldsToType, KeyValueData, SettingsField, TrackerField, TrackerSearchResults, TrackerSettings, TrackerAfterUploadAction, Metadata, TrackerLayout } from '$lib/types';
import z from 'zod';
import type Release from '../release';
import Tracker from '../tracker';
import { unit3dDistributors, unit3dRegions } from './unit3d-distributors';
import { log } from '../util/log';
import errorString from '../util/error-string';
import { TTLCache } from '@isaacs/ttlcache';
import pMemoize from 'p-memoize';

const UPLOAD_URL = 'https://lst.gg/api/torrents/upload';
const SEARCH_URL = 'https://lst.gg/api/torrents/filter';
const BANNED_GROUPS_URL = 'https://lst.gg/api/bannedReleaseGroups';
const CREATE_TRUMPING_REPORT_URL = (id: number) => `https://lst.gg/api/reports/torrents/${id}/trump`;

const BannedGroupsSchema = z.array(z.object({
    name: z.string(),
    type: z.string(),
    reason: z.string(),
}));

const SearchResultsSchema = z.object({
    data: z.array(z.object({
        id: z.string(),
        attributes: z.object({
            name: z.string(),
            details_link: z.httpUrl(), // TODO: verify filter endpoint includes details_link in attributes
        }),
    })),
    links: z.object({
        next: z.httpUrl().nullable(),
    }),
});

const categories: KeyValueData = [
    ['1', 'Movies'],
    ['2', 'TV'],
    ['3', 'Music'],
    ['4', 'Game'],
    ['5', 'Application'],
    ['8', 'XXX'],
    ['9', 'Ebook/Manga'],
    ['10', 'Education'],
    ['11', 'FANRES'],
];

const types: KeyValueData = [
    ['1', 'Full Disc'],
    ['2', 'Remux'],
    ['3', 'Encode'],
    ['4', 'WEB-DL'],
    ['5', 'WEBRip'],
    ['6', 'HDTV'],
    ['16', 'SDTV'],
    ['7', 'Other'],
];

const resolutions: KeyValueData = [
    ['1', '4320p'],
    ['2', '2160p'],
    ['3', '1080p'],
    ['4', '1080i'],
    ['5', '720p'],
    ['6', '576p'],
    ['7', '576i'],
    ['8', '480p'],
    ['9', '480i'],
    ['10', 'Other'],
    ['11', 'Extras'],
];

const frees: KeyValueData = [
    ['0', 'No Freeleech'],
    ['25', '25% Freeleech'],
    ['50', '50% Freeleech'],
    ['75', '75% Freeleech'],
    ['100', '100% Freeleech'],
];

const hdrDvs: KeyValueData = [
    ['', 'None'],
    ['HDR10', 'HDR10'],
    ['HDR10+', 'HDR10+'],
    ['DV P5', 'DV P5'],
    ['DV P7 HDR', 'DV P7 HDR'],
    ['DV P8 HDR', 'DV P8 HDR'],
    ['DV P10 HDR', 'DV P10 HDR'],
    ['DV P7 HDR10+', 'DV P7 HDR10+'],
    ['DV P8 HDR10+', 'DV P8 HDR10+'],
    ['DV P10 HDR10+', 'DV P10 HDR10+'],
    ['DV P5 HDR Vivid', 'DV P5 HDR Vivid'],
    ['DV P7 HDR Vivid', 'DV P7 HDR Vivid'],
    ['DV P8 HDR Vivid', 'DV P8 HDR Vivid'],
    ['DV P10 HDR Vivid', 'DV P10 HDR Vivid'],
    ['DV P20 HDR Vivid', 'DV P20 HDR Vivid'],
    ['DV P20', 'DV P20'],
    ['HDR Vivid', 'HDR Vivid'],
    ['HLG', 'HLG'],
    ['PQ10', 'PQ10'],
];

const editions: KeyValueData = [
    ['', ''],
    ['12', 'Alternative Cut'],
    ['1', "Collector's Edition"],
    ['2', "Director's Cut"],
    ['3', 'Extended Cut'],
    ['4', 'Extended Uncut'],
    ['5', 'Extended Unrated'],
    ['6', 'Limited Edition'],
    ['7', 'Special Edition'],
    ['8', 'Theatrical Cut'],
    ['9', 'Uncut'],
    ['10', 'Unrated'],
    ['11', 'X Cut'],
];

export const regions: KeyValueData = unit3dRegions;
export const distributors: KeyValueData = unit3dDistributors;

export const lstSettings: SettingsField[] = [
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'You can find your announce URL on the <a href="https://lst.gg/torrents/create">upload page</a>.',
    }, {
        id: 'apiKey',
        label: 'API key',
        type: 'password',
        description: 'Your API key can be found in your profile, under Settings, API Key.',
    }, {
        id: 'defaultDescription',
        label: 'Default description',
        type: 'multiline',
        default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}',
    }
];

const fields = [
    { key: 'name', label: 'Title', type: 'text', default: '' },
    { key: 'category_id', label: 'Category', type: 'select', default: 'Movies', options: categories, size: 13 },
    { key: 'type_id', label: 'Type', type: 'select', default: 'Other', options: types, size: 13 },
    { key: 'resolution_id', label: 'Resolution', type: 'select', default: 'Other', options: resolutions, size: 13 },
    { key: 'provider', label: 'Provider', type: 'text', default: '', size: 13 },
    { key: 'distributor_id', label: 'Distributor', type: 'select', default: '', options: distributors, size: 35 },
    { key: 'region_id', label: 'Region', type: 'select', default: '', options: regions, size: 13 },
    { key: 'edition_id', label: 'Edition', type: 'select', default: '', options: editions, size: 13 },
    { key: 'season_number', label: 'Season', type: 'text', default: '', size: 3 },
    { key: 'episode_number', label: 'Episode', type: 'text', default: '', size: 3 },
    { key: 'hdr_dv', label: 'HDR/DV', type: 'select', default: 'None', options: hdrDvs, size: 20 },
    { key: 'dual_audio', label: 'Dual audio', type: 'checkbox', default: false },
    { key: 'tmdb', label: 'TMDB ID', type: 'text', default: '', size: 10 },
    { key: 'imdb', label: 'IMDB ID', type: 'text', default: '', size: 10 },
    { key: 'tvdb', label: 'TVDB ID', type: 'text', default: '', size: 10 },
    { key: 'mal', label: 'MAL ID', type: 'text', default: '', size: 10 },
    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'multiline', default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}' },
    { key: 'mediainfo', label: 'MediaInfo', type: 'multiline', default: '{{ mediaInfo.fullText }}' },
    { key: 'bdinfo', label: 'BDInfo', type: 'multiline', default: '' },
    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },
    { key: 'personal_release', label: 'Personal release', type: 'checkbox', default: false },
    { key: 'mod_queue_opt_in', label: 'Opt in to mod queue', type: 'checkbox', default: false },
    { key: 'draft_queue_opt_in', label: 'Save as draft', type: 'checkbox', default: false },
    { key: 'internal', label: 'Internal', type: 'checkbox', default: false },
    { key: 'refundable', label: 'Refundable', type: 'checkbox', default: false },
    { key: 'free', label: 'Freeleech', type: 'select', default: 'No Freeleech', options: frees, size: 16 },
] as const satisfies TrackerField[];

const layout = [
    ['name',               'name',           'name',          'name'],
    ['category_id',        'type_id',        'resolution_id', 'provider'],
    ['distributor_id',     'distributor_id', 'region_id',     'edition_id'],
    ['season_number',      'episode_number'],
    ['hdr_dv',             'hdr_dv'],
    ['dual_audio'],
    ['tmdb',               'imdb',           'tvdb',          'mal'],
    ['keywords',           'keywords',       'keywords',      'keywords'],
    ['description',        'description',    'description',   'description'],
    ['mediainfo',          'mediainfo',      'mediainfo',     'mediainfo'],
    ['bdinfo',             'bdinfo',         'bdinfo',        'bdinfo'],
    ['anonymous',          'internal'],
    ['personal_release',   'refundable'],
    ['mod_queue_opt_in',   'free'],
    ['draft_queue_opt_in', 'free'],
] as const satisfies TrackerLayout;

const bannedGroupsCache = new TTLCache<unknown, string[]>({ ttl: 1000 * 60 * 60 });

export default class LST extends Tracker {

    apiKey: string = '';
    override name: string = 'LST';
    override data: FieldsToType<typeof fields>;
    override readonly fields = fields;
    override readonly layout = layout;
    source: string = 'LST';
    private getBannedGroups: typeof this._getBannedGroups;

    constructor(settings: TrackerSettings) {

        super(settings);
        this.data = this.setDefaults(this.fields);

        if (!settings.apiKey) throw Error('API key is missing for LST');
        this.apiKey = settings.apiKey;

        if (settings.defaultDescription) this.data.description = settings.defaultDescription;

        this.getBannedGroups = pMemoize(this._getBannedGroups, { cache: bannedGroupsCache });

    }

    private get headers(): Headers {
        return new Headers({
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        });
    }

    applyMetadata(metadata: Metadata) {
        this.data.tmdb = String(metadata.tmdbId);
        this.data.imdb = metadata.imdbId ? metadata.imdbId.replace(/^tt/i, '') : '0';
        this.data.tvdb = metadata.tvdbId ? String(metadata.tvdbId) : '0';
        this.data.mal = metadata.malId ? String(metadata.malId) : '0';
        this.data.keywords = metadata.keywords.join(', ');
    }

    applyRelease(release: Release) {

        this.setOption('resolution_id', 'Other');
        if (release.resolution) this.setOption('resolution_id', release.resolution);

        this.setOption('type_id', 'Other');
        if (release.fullDisc) {
            this.setOption('type_id', 'Full Disc');
        } else if (release.remux) {
            this.setOption('type_id', 'Remux');
        } else if (release.source === 'BluRay' || release.source === 'DVDRip') {
            this.setOption('type_id', 'Encode');
        } else if (release.source?.endsWith('WEB-DL')) {
            this.setOption('type_id', 'WEB-DL');
        } else if (release.source?.endsWith('WEBRip')) {
            this.setOption('type_id', 'WEBRip');
        } else if (release.source === 'HDTV') {
            this.setOption('type_id', 'HDTV');
        }

        if (release.streamingService) this.data.provider = release.streamingService;

        if (release.censored === 'UNCUT') this.setOption('edition_id', 'Uncut');
        if (release.censored === 'UNRATED') this.setOption('edition_id', 'Unrated');

        switch (release.edition) {
            case 'Alternative Cut':
            case "Collector's Edition":
            case "Director's Cut":
            case 'Limited Edition':
            case 'Special Edition':
            case 'Theatrical Cut':
                this.setOption('edition_id', release.edition);
                break;
            case 'Extended':
                this.setOption('edition_id', 'Extended Cut');
                if (release.censored === 'UNCUT') this.setOption('edition_id', 'Extended Uncut');
                if (release.censored === 'UNRATED') this.setOption('edition_id', 'Extended Unrated');
                break;
        }

        {
            const hdrParts: string[] = [];
            if (release.dvProfile) hdrParts.push(`DV P${release.dvProfile}`);
            if (release.hdr) hdrParts.push(release.hdr.plus);
            if (hdrParts.length > 0) {
                const hdrString = hdrParts.join(' ')
                try { this.setOption('hdr_dv', hdrString); }
                catch (error) { log(`Invalid HDR option for LST: ${hdrString}`, 'khaki') }
            }
        }

        if (release.multiAudio) this.data.dual_audio = true;

        const type = this.getOption('type_id');

        let titleFormat = '';

        if (release.category === 'tv') {

            this.setOption('category_id', 'TV');
            this.data.season_number = release.season ? String(release.season) : '0';
            this.data.episode_number = release.episode ? String(release.episode) : '0';

            titleFormat = '{title aka} {season_episode} {edition} {language if_not_dual_audio} {attributes} {repack} {resolution} {source} ';

        } else if (release.category === 'movie') {

            this.setOption('category_id', 'Movies');

            titleFormat = '{title aka} {year} {edition} {language if_not_dual_audio} {attributes} {repack} {resolution} {source} ';

        }

        switch (type) {

            case 'WEB-DL':
                titleFormat += '{audio plus} {video like_h264}';
                break;

            case 'WEBRip':
            case 'HDTV':
            case 'Encode':
                titleFormat += '{audio plus} {video encoder}';
                break;

            case 'Remux':
                titleFormat += '{remux} {video like_avc} {audio plus}';
                break;

            case 'Full Disc':
                titleFormat += '{video like_avc} {audio plus}';
                break;

            default:
                titleFormat += '{audio plus} {video encoder}';

        }

        titleFormat += '-{group}';

        this.data.name = release.format(titleFormat);

    }

    private checkBannedGroup(bannedGroups: string[]) {

        // LST bans groups site-wide, not per type — simpler check than Aither
        const group = this.release?.group?.toLowerCase();
        if (!group) return;

        const isBanned = bannedGroups.some(name => name.toLowerCase() === group);
        if (isBanned) {
            throw Error(`Release group ${this.release!.group} is banned on LST`);
        }

    }

    private async _getBannedGroups(): Promise<string[]> {

        try {

            const response = await fetch(BANNED_GROUPS_URL, { headers: this.headers });
            const body = await response.json();

            if (!response.ok) {
                throw Error(body.message ?? response.statusText);
            }

            const validated = BannedGroupsSchema.parse(body);
            return validated.map(item => item.name);

        } catch (error) {
            log(errorString('Problem getting banned groups', error), 'khaki');
            return [];
        }

    }

    private appendCommonSearchParams(params: URLSearchParams) {

        params.append('tmdbId', this.data.tmdb);
        params.append('categories[]', this.data.category_id);
        params.append('resolutions[]', this.data.resolution_id);
        if (this.data.hdr_dv) params.append('hdrDv[]', this.data.hdr_dv);

        // Treating HDTV/WEBRip/WEB-DL as the same for searches like Aither
        // but it's probably unnecessary
        if (['4', '5', '6'].includes(this.data.type_id)) {
            params.append('types[]', '4');
            params.append('types[]', '5');
            params.append('types[]', '6');
        } else {
            params.append('types[]', this.data.type_id);
        }
    }

    async search(): Promise<TrackerSearchResults> {

        const url = new URL(SEARCH_URL);
        const params = url.searchParams;
        this.appendCommonSearchParams(params);

        if (this.data.season_number) params.append('seasonNumber', this.data.season_number);
        if (this.data.episode_number) params.append('episodeNumber', this.data.episode_number);

        const response = await fetch(url, { headers: this.headers });
        const data = await response.json();

        const validated = SearchResultsSchema.parse(data).data;

        const output: TrackerSearchResults = [];

        for (const result of validated) {
            output.push({
                name: result.attributes.name,
                url: result.attributes.details_link,
            });
        }

        return output;

    }

    override async validate() {
        const bannedGroups = await this.getBannedGroups();
        this.checkBannedGroup(bannedGroups);
    }

    protected override async upload(torrent: Blob, filename: string, signal: AbortSignal) {

        const formData = new FormData();

        formData.set('torrent', torrent, filename);

        const {
            name, description, mediainfo, bdinfo, keywords, season_number,
            episode_number, tmdb, imdb, tvdb, mal, category_id, type_id,
            resolution_id, region_id, distributor_id, hdr_dv, provider,
            dual_audio, anonymous, personal_release, internal, free, edition_id,
            refundable, mod_queue_opt_in, draft_queue_opt_in

        } = this.data;

        formData.set('name', name);
        formData.set('description', description);
        formData.set('mediainfo', mediainfo);
        formData.set('bdinfo', bdinfo);

        formData.set('category_id', category_id);
        formData.set('type_id', type_id);
        formData.set('resolution_id', resolution_id);
        formData.set('keywords', keywords);

        if (region_id) formData.set('region_id', region_id);
        if (distributor_id) formData.set('distributor_id', distributor_id);
        if (edition_id) formData.set('edition_id', edition_id);
        if (hdr_dv) formData.set('hdr_dv', hdr_dv);
        if (provider) formData.set('provider', provider);

        if (category_id === '2') {  // TV
            formData.set('season_number', season_number);
            formData.set('episode_number', episode_number);
        }

        formData.set('tmdb', tmdb || '0');
        formData.set('imdb', imdb || '0');
        formData.set('tvdb', tvdb || '0');
        formData.set('mal', mal || '0');
        formData.set('igdb', '0');

        formData.set('anonymous', anonymous ? '1' : '0');
        formData.set('dual_audio', dual_audio ? '1' : '0');
        formData.set('personal_release', personal_release ? '1' : '0');

        if (mod_queue_opt_in) formData.set('mod_queue_opt_in', '1');
        if (draft_queue_opt_in) formData.set('draft_queue_opt_in', '1');

        if (internal) formData.set('internal', '1');
        if (refundable) formData.set('refundable', '1');
        if (free !== '0') formData.set('free', free);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: this.headers,
            body: formData,
            signal,
        });

        const body = await response.json();

        console.log(body);

        if (!response.ok || !body.success) {
            const ErrorSchema = z.record(z.string(), z.array(z.string()));
            const errors = ErrorSchema.safeParse(body.data).data;
            if (errors) {
                const flattenedErrors = Object.values(errors).flat().join(' ');
                throw Error(flattenedErrors);
            }
            throw Error(body.message ?? response.statusText);
        }

        const validated = z.object({ data: z.httpUrl() }).parse(body);

        return validated.data;

    }
    
    private async getUploadedUrl(signal: AbortSignal) {

        const url = new URL(SEARCH_URL);
        url.searchParams.set('name', this.data.name);

        const response = await fetch(url, { headers: this.headers, signal });
        const body = await response.json();

        if (!response.ok) throw Error(`Couldn't find torrent: ${body.message ?? response.statusText}`);

        const validated = SearchResultsSchema.parse(body).data;

        const found = validated.find(torrent => torrent.attributes.name === this.data.name);
        if (!found) throw Error("Couldn't find torrent");
        
        return found.attributes.details_link;

    }

    private async getRepackTrumpingCandidates(signal: AbortSignal): Promise<{ id: string, name: string }[]> {

        if (!this.release?.repack) return [];

        const url = new URL(SEARCH_URL);
        const params = url.searchParams;

        this.appendCommonSearchParams(params);
        if (this.data.season_number) params.append('seasonNumber', this.data.season_number);
        if (this.data.episode_number) params.append('episodeNumber', this.data.episode_number);

        const response = await fetch(url, { headers: this.headers, signal });
        const body = await response.json();

        if (!response.ok) throw Error(`Couldn't find repack trumping candidates: ${body.message ?? response.statusText}`);

        const results = SearchResultsSchema.parse(body).data;

        const filtered = results.filter(
            result => result.attributes.name.toLowerCase().endsWith(`-${this.release!.group!}`.toLowerCase())
        );

        return filtered.map(result => ({ id: result.id, name: result.attributes.name }));

    }

    private async getSeasonPackTrumpingCandidates(signal: AbortSignal): Promise<{ id: string, name: string, episode: number }[]> {

        if (!this.release?.isSeasonPack) return [];

        const url = new URL(SEARCH_URL);
        const params = url.searchParams;
        this.appendCommonSearchParams(params);
        params.append('seasonNumber', this.data.season_number);

        const results = [];
        let next: string | null = null;

        do {

            const response = await fetch(next ?? url, { headers: this.headers, signal });
            const body = await response.json();

            if (!response.ok) throw Error(`Couldn't find season pack trumping candidates: ${body.message ?? response.statusText}`);

            const validated = SearchResultsSchema.parse(body);
            next = validated.links.next;
            const data = validated.data;

            for (const result of data) {
                const match = result.attributes.name.match(/\bS\d+E(\d+)\b/i);
                if (!match) continue;
                const episode = parseInt(match[1]!, 10);
                results.push({
                    id: result.id,
                    name: result.attributes.name,
                    episode,
                });
            }

        } while (next);

        if (results.length === 0) return [];

        let filtered: typeof results = [];

        if (this.release?.group) {
            filtered = results.filter(
                result => result.name.toLowerCase().endsWith(`-${this.release!.group!}`.toLowerCase())
            );
        }

        const grouped = Object.groupBy(
            filtered.length > 0 ? filtered : results,
            ({ episode }) => String(episode)
        );

        const mostEpisodes = Object.values(grouped)
            .filter(group => group)
            .reduce((a, b) => b!.length > a!.length ? b : a);

        return mostEpisodes ?? [];

    }

    private async createTrumpingReport(oldId: number, newUrl: string, reason: 'Season pack' | 'Repack', signal: AbortSignal) {

        const payload = { message: `${reason} available: ${newUrl}` };

        const headers = this.headers;
        headers.append('Content-Type', 'application/json');

        const response = await fetch(CREATE_TRUMPING_REPORT_URL(oldId), {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal
        });

        const body = await response.json();
        if (!response.ok || !body.success) throw Error(`Failed to create trumping report: ${body.message ?? response.statusText}`);

    }

    override async getAfterUploadActions(signal: AbortSignal): Promise<TrackerAfterUploadAction[]> {

        const output: TrackerAfterUploadAction[] = [];

        let url: string = '';

        {
            const candidates = await this.getSeasonPackTrumpingCandidates(signal);
            for (const candidate of candidates) {
                output.push({
                    label: `Trump as season pack: ${candidate.name}`,
                    action: async () => {
                        if (!url) url = await this.getUploadedUrl(signal);
                        await this.createTrumpingReport(parseInt(candidate.id), url, 'Season pack', signal);
                    }
                })
            }
        }

        {
            const candidates = await this.getRepackTrumpingCandidates(signal);
            for (const candidate of candidates) {
                output.push({
                    label: `Trump as repack: ${candidate.name}`,
                    action: async() => {
                        if (!url) url = await this.getUploadedUrl(signal);
                        await this.createTrumpingReport(parseInt(candidate.id), url, 'Repack', signal)
                    }
                });
            }
        }

        return output;

    }

}
