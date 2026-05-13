import type { FieldsToType, KeyValueData, SettingsField, TrackerField, TrackerSearchResults, TrackerSettings, TrackerAfterUploadAction, Metadata, TrackerLayout } from '$lib/types';
import * as v from 'valibot';
import type Release from '../release';
import Tracker from '../tracker';
import { unit3dDistributors, unit3dRegions } from './unit3d-distributors';
import { log } from '../util/log';
import errorString from '../util/error-string';

const UPLOAD_URL = 'https://seedpool.org/api/torrents/upload';
const SEARCH_URL = 'https://seedpool.org/api/torrents/filter';

const SearchResultsSchema = v.object({
    data: v.array(v.object({
        id: v.string(),
        attributes: v.object({
            name: v.string(),
            details_link: v.pipe(v.string(), v.url()),
        }),
    })),
    links: v.object({
        next: v.nullable(v.pipe(v.string(), v.url())),
    }),
});

export const categories: KeyValueData = [
    ['1', 'Movie'],
    ['2', 'TV'],
    ['6', 'Anime'],
    ['8', 'Sports'],
];

export const types: KeyValueData = [
    ['1', 'Full Disc'],
    ['2', 'Remux'],
    ['3', 'Encode'],
    ['4', 'WEB-DL'],
    ['5', 'WEBRip'],
    ['6', 'HDTV'],
    ['7', 'Other'],
];

export const resolutions: KeyValueData = [
    ['1', '4320p'],
    ['2', '2160p'],
    ['3', '1080p'],
    ['4', '1080i'],
    ['5', '720p'],
    ['11', '1440p'],
    ['6', '576p'],
    ['7', '576i'],
    ['8', '480p'],
    ['9', '480i'],
    ['10', 'Other'],
];

export const frees: KeyValueData = [
    ['0', 'No Freeleech'],
    ['25', '25% Freeleech'],
    ['50', '50% Freeleech'],
    ['75', '75% Freeleech'],
    ['100', '100% Freeleech'],
];

export const regions: KeyValueData = unit3dRegions;
export const distributors: KeyValueData = unit3dDistributors;

export const settings: SettingsField[] = [
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'You can find your announce URL on the <a href="https://seedpool.org/upload">upload page</a>.',
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

export const fields = [
    { key: 'name', label: 'Title', type: 'text', default: '' },
    { key: 'categoryId', label: 'Category', type: 'select', default: 'Movie', options: categories, size: 13 },
    { key: 'typeId', label: 'Type', type: 'select', default: 'Other', options: types, size: 13 },
    { key: 'resolutionId', label: 'Resolution', type: 'select', default: 'Other', options: resolutions, size: 13 },
    { key: 'distributorId', label: 'Distributor', type: 'select', default: '', options: distributors, size: 35 },
    { key: 'regionId', label: 'Region', type: 'select', default: '', options: regions, size: 13 },
    { key: 'seasonNumber', label: 'Season', type: 'text', default: '', size: 3 },
    { key: 'episodeNumber', label: 'Episode', type: 'text', default: '', size: 3 },
    { key: 'tmdb', label: 'TMDB ID', type: 'text', default: '', size: 10 },
    { key: 'imdb', label: 'IMDb ID', type: 'text', default: '', size: 10 },
    { key: 'tvdb', label: 'TVDB ID', type: 'text', default: '', size: 10 },
    { key: 'mal', label: 'MAL ID', type: 'text', default: '', size: 10 },
    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'multiline', default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}' },
    { key: 'mediaInfo', label: 'MediaInfo', type: 'multiline', default: '{{ mediaInfo.fullText }}' },
    { key: 'bdInfo', label: 'BDInfo', type: 'multiline', default: '' },
    { key: 'dv', label: 'Dolby Vision', type: 'checkbox', default: false },
    { key: 'hdr', label: 'HDR', type: 'checkbox', default: false },
    { key: 'hdr10p', label: 'HDR10+', type: 'checkbox', default: false },
    { key: 'sd', label: 'Standard definition', type: 'checkbox', default: false },
    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },
    { key: 'internal', label: 'Internal', type: 'checkbox', default: false },
    { key: 'exclusive', label: 'Exclusive', type: 'checkbox', default: false },
    { key: 'free', label: 'Freeleech', type: 'select', default: 'No Freeleech', options: frees, size: 16 },
] as const satisfies TrackerField[];

const layout = [
    ['name',          'name',            'name',        'name'],
    ['categoryId',    'typeId',          'resolutionId'],
    ['distributorId', 'distributorId',   'regionId'],
    ['seasonNumber',  'episodeNumber'],
    ['tmdb',          'imdb',            'tvdb',        'mal'],
    ['keywords',      'keywords',        'keywords',    'keywords'],
    ['description',   'description',     'description', 'description'],
    ['mediaInfo',     'mediaInfo',       'mediaInfo',   'mediaInfo'],
    ['bdInfo',        'bdInfo',          'bdInfo',      'bdInfo'],
    ['dv',            'anonymous',       'internal'],
    ['hdr',           'exclusive',       'free'],
    ['hdr10p',        'sd',              'free'],
] as const satisfies TrackerLayout;

export default class Seedpool extends Tracker {
    apiKey: string = '';
    override name: string = 'Seedpool';
    override data: FieldsToType<typeof fields>;
    override readonly fields = fields;
    override readonly layout = layout;
    source: string = 'Seedpool';

    constructor(settings: TrackerSettings) {
        super(settings);
        this.data = this.setDefaults(this.fields);

        if (!settings.apiKey) throw Error('API key is missing for Seedpool');
        this.apiKey = settings.apiKey;

        if (settings.defaultDescription) this.data.description = settings.defaultDescription;
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
        this.setOption('resolutionId', 'Other');
        if (release.resolution) this.setOption('resolutionId', release.resolution);

        this.setOption('typeId', 'Other');
        if (release.fullDisc) {
            this.setOption('typeId', 'Full Disc');
        } else if (release.remux) {
            this.setOption('typeId', 'Remux');
        } else if (release.source === 'BluRay' || release.source === 'DVDRip') {
            this.setOption('typeId', 'Encode');
        } else if (release.source?.endsWith('WEB-DL')) {
            this.setOption('typeId', 'WEB-DL');
        } else if (release.source?.endsWith('WEBRip')) {
            this.setOption('typeId', 'WEBRip');
        } else if (release.source === 'HDTV') {
            this.setOption('typeId', 'HDTV');
        }

        const sportsPatterns = [
            /EFL.*/i, /.*mlb.*/i, /.*formula1.*/i, /.*nascar.*/i, /.*nfl.*/i, /.*wrc.*/i, /.*wwe.*/i,
            /.*fifa.*/i, /.*boxing.*/i, /.*rally.*/i, /.*ufc.*/i, /.*ppv.*/i, /.*uefa.*/i, /.*nhl.*/i,
            /.*nba.*/i, /.*motogp.*/i, /.*moto2.*/i, /.*moto3.*/i, /.*gamenight.*/i, /.*darksport.*/i,
            /.*overtake.*/i
        ];

        if (sportsPatterns.some(pattern => pattern.test(release.title || ''))) {
            this.setOption('categoryId', 'Sports');
        } else if (release.malId && release.category === 'tv') {
            this.setOption('categoryId', 'Anime');
        } else if (release.category === 'tv') {
            this.setOption('categoryId', 'TV');
        } else {
            this.setOption('categoryId', 'Movie');
        }

        if (release.dv) this.data.dv = true;
        if (release.hdr?.plus === 'HDR') this.data.hdr = true;
        if (release.hdr?.plus === 'HDR10+') this.data.hdr10p = true;
        
        const resolution = parseInt(release.resolution ?? '0');
        if (resolution <= 576 && resolution > 0) this.data.sd = true;

        let titleFormat = '{title aka} {year} {edition} {language if_not_dual_audio} {attributes} {repack} {resolution} {source} ';
        
        if (release.category === 'tv') {
            this.data.seasonNumber = release.season ? String(release.season) : '0';
            this.data.episodeNumber = release.episode ? String(release.episode) : '0';
            titleFormat = '{title aka} {season_episode} {season_or_episode_title} {edition} {language if_not_dual_audio} {attributes} {repack} {resolution} {source} ';
        }

        const type = this.getOption('typeId');
        switch (type) {
            case 'WEB-DL': titleFormat += '{audio plus} {video like_h264}'; break;
            case 'Remux': titleFormat += '{remux} {video like_avc} {audio plus}'; break;
            case 'Full Disc': titleFormat += '{video like_avc} {audio plus}'; break;
            default: titleFormat += '{audio plus} {video encoder}';
        }

        titleFormat += '-{group}';
        this.data.name = release.format(titleFormat);
    }

    async search(): Promise<TrackerSearchResults> {
        const url = new URL(SEARCH_URL);
        const params = url.searchParams;
        params.append('tmdbId', this.data.tmdb);
        params.append('categories[]', this.data.categoryId);
        params.append('resolutions[]', this.data.resolutionId);
        params.append('types[]', this.data.typeId);

        if (this.data.seasonNumber) params.append('seasonNumber', this.data.seasonNumber);
        if (this.data.episodeNumber) params.append('episodeNumber', this.data.episodeNumber);

        const response = await fetch(url, { headers: this.headers });
        const data = await response.json();
        const validated = v.parse(SearchResultsSchema, data).data;

        return validated.map(result => ({
            name: result.attributes.name,
            url: result.attributes.details_link,
        }));
    }

    protected override async upload(torrent: Blob, filename: string, signal: AbortSignal) {
        const formData = new FormData();
        formData.set('torrent', torrent, filename);

        const d = this.data;
        formData.set('name', d.name);
        formData.set('description', d.description);
        formData.set('mediainfo', d.mediaInfo);
        formData.set('bdinfo', d.bdInfo);
        formData.set('category_id', d.categoryId);
        formData.set('type_id', d.typeId);
        formData.set('resolution_id', d.resolutionId);
        formData.set('keywords', d.keywords);

        if (d.regionId) formData.set('region_id', d.regionId);
        if (d.distributorId) formData.set('distributor_id', d.distributorId);
        if (d.categoryId === '2') {
            formData.set('season_number', d.seasonNumber);
            formData.set('episode_number', d.episodeNumber);
        }

        formData.set('tmdb', d.tmdb || '0');
        formData.set('imdb', d.imdb || '0');
        formData.set('tvdb', d.tvdb || '0');
        formData.set('mal', d.mal || '0');

        formData.set('anonymous', d.anonymous ? '1' : '0');
        formData.set('sd', d.sd ? '1' : '0');
        formData.set('dv', d.dv ? '1' : '0');
        formData.set('hdr', d.hdr ? '1' : '0');
        formData.set('hdr10p', d.hdr10p ? '1' : '0');
        formData.set('internal', d.internal ? '1' : '0');
        formData.set('exclusive', d.exclusive ? '1' : '0');
        if (d.free !== '0') formData.set('free', d.free);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: this.headers,
            body: formData,
            signal,
        });
        
        const body = await response.json();
        if (!response.ok || !body.success) throw Error(body.message ?? response.statusText);

        const validated = v.parse(v.object({ data: v.pipe(v.string(), v.url())}), body);
        return validated.data;
    }
}
