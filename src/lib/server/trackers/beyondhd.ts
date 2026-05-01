import type { FieldsToType, KeyValueData, SettingsField, TrackerField, TrackerSearchResults, TrackerSettings, Metadata, TrackerLayout } from '$lib/types';
import * as v from 'valibot';
import type Release from '../release';
import Tracker from '../tracker';

const UPLOAD_URL = (apiKey: string) => `https://beyond-hd.me/api/upload/${apiKey}`;
const SEARCH_URL = (apiKey: string) => `https://beyond-hd.me/api/torrents/${apiKey}`;

const SearchResultsSchema = v.object({
    status_code: v.number(),
    results: v.optional(v.array(v.object({
        id: v.number(),
        name: v.string(),
        url: v.pipe(v.string(), v.url()),
    })), []),
    total_results: v.optional(v.number(), 0),
    success: v.boolean(),
});

const UploadResponseSchema = v.object({
    status_code: v.number(),
    status_message: v.string(),
    success: v.boolean(),
});

const categories: KeyValueData = [
    ['1', 'Movies'],
    ['2', 'TV'],
];

const types: KeyValueData = [
    ['UHD Remux', 'UHD Remux'],
    ['BD Remux', 'BD Remux'],
    ['DVD Remux', 'DVD Remux'],
    ['2160p', '2160p'],
    ['1080p', '1080p'],
    ['1080i', '1080i'],
    ['720p', '720p'],
    ['576p', '576p'],
    ['576i', '576i'],
    ['540p', '540p'],
    ['480p', '480p'],
    ['Other', 'Other'],
];

const sources: KeyValueData = [
    ['Blu-ray', 'Blu-ray'],
    ['HD-DVD', 'HD-DVD'],
    ['WEB', 'WEB'],
    ['HDTV', 'HDTV'],
    ['DVD', 'DVD'],
];

const editions: KeyValueData = [
    ['', ''],
    ['Collector', "Collector's Edition"],
    ['Director', "Director's Cut"],
    ['Extended', 'Extended Cut'],
    ['Limited', 'Limited Edition'],
    ['Special', 'Special Edition'],
    ['Theatrical', 'Theatrical Cut'],
    ['Uncut', 'Uncut'],
    ['Unrated', 'Unrated'],
];

const regions: KeyValueData = [
    ['', ''],
    ['AUS', 'AUS'], ['BRA', 'BRA'], ['CAN', 'CAN'], ['CEE', 'CEE'],
    ['CHN', 'CHN'], ['CZE', 'CZE'], ['ESP', 'ESP'], ['EUR', 'EUR'],
    ['FRA', 'FRA'], ['GBR', 'GBR'], ['GER', 'GER'], ['HKG', 'HKG'],
    ['ITA', 'ITA'], ['JPN', 'JPN'], ['KOR', 'KOR'], ['NOR', 'NOR'],
    ['NLD', 'NLD'], ['RUS', 'RUS'], ['TWN', 'TWN'], ['USA', 'USA'],
];

const distributors: KeyValueData = [
    ['', ''],
    ['20th-century-fox', '20th Century Fox'],
    ['88-films', '88 Films'],
    ['acorn', 'Acorn'],
    ['alchemy', 'Alchemy'],
    ['anchor-bay', 'Anchor Bay'],
    ['arrow', 'Arrow'],
    ['bfi-video', 'BFI Video'],
    ['blue-underground', 'Blue Underground'],
    ['carlotta-films', 'Carlotta Films'],
    ['cauldron-films', 'Cauldron Films'],
    ['cinedigm', 'Cinedigm'],
    ['code-red', 'Code Red'],
    ['criterion', 'Criterion'],
    ['discotek-media', 'Discotek Media'],
    ['eureka-entertainment', 'Eureka Entertainment'],
    ['first-run-features', 'First Run Features'],
    ['image', 'Image'],
    ['imprint', 'Imprint'],
    ['indicator', 'Indicator'],
    ['kino-lorber', 'Kino Lorber'],
    ['lionsgate', 'Lionsgate'],
    ['mpi', 'MPI'],
    ['magnolia', 'Magnolia'],
    ['mill-creek', 'Mill Creek'],
    ['monterey', 'Monterey'],
    ['music-box-films', 'Music Box Films'],
    ['ncircle', 'NCircle'],
    ['naxos', 'Naxos'],
    ['olive-films', 'Olive Films'],
    ['oscilloscope', 'Oscilloscope'],
    ['pbs', 'PBS'],
    ['paramount', 'Paramount'],
    ['radiance-films', 'Radiance Films'],
    ['raro-video', 'Raro Video'],
    ['screen-media', 'Screen Media'],
    ['second-sight', 'Second Sight'],
    ['severin', 'Severin'],
    ['shout-factory', 'Shout Factory'],
    ['sony-pictures', 'Sony Pictures'],
    ['starz', 'Starz'],
    ['synapse-films', 'Synapse Films'],
    ['terror-vision', 'Terror Vision'],
    ['twilight-time', 'Twilight Time'],
    ['umbrella-entertainment', 'Umbrella Entertainment'],
    ['universal-pictures', 'Universal Pictures'],
    ['vinegar-syndrome', 'Vinegar Syndrome'],
    ['walt-disney-studios', 'Walt Disney Studios'],
    ['warner', 'Warner'],
    ['wellgo', 'Wellgo'],
];

const providers: KeyValueData = [
    ['', ''],
    ['all4', 'ALL4'],
    ['amzn', 'AMZN'],
    ['atv', 'ATV'],
    ['atvp', 'ATVP'],
    ['bcore', 'BCORE'],
    ['cr', 'CR'],
    ['crav', 'CRAV'],
    ['disc', 'DISC'],
    ['dscp', 'DSCP'],
    ['dsnp', 'DSNP'],
    ['hbo', 'HBO'],
    ['hidi', 'HIDI'],
    ['hmax', 'HMAX'],
    ['hulu', 'HULU'],
    ['ma', 'MA'],
    ['max', 'MAX'],
    ['nf', 'NF'],
    ['now', 'NOW'],
    ['pcok', 'PCOK'],
    ['pmtp', 'PMTP'],
    ['red', 'RED'],
    ['sho', 'SHO'],
    ['stan', 'STAN'],
    ['tubi', 'TUBI'],
    ['viap', 'VIAP'],
    ['vmeo', 'VMEO'],
    ['ip', 'iP'],
    ['it', 'iT'],
];

export const settings: SettingsField[] = [
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'Your announce URL from the <a href="https://beyond-hd.me/torrents/create">upload page</a>.',
    }, {
        id: 'apiKey',
        label: 'API key',
        type: 'password',
        description: 'Your API key from BHD settings.',
    }, {
        id: 'defaultDescription',
        label: 'Default description',
        type: 'multiline',
        default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}',
    }
];

export const fields = [
    { key: 'name', label: 'Title', type: 'text', default: '' },
    { key: 'categoryId', label: 'Category', type: 'select', default: 'Movies', options: categories, size: 13 },
    { key: 'type', label: 'Type', type: 'select', default: 'Other', options: types, size: 13 },
    { key: 'source', label: 'Source', type: 'select', default: 'WEB', options: sources, size: 13 },
    { key: 'provider', label: 'Provider', type: 'select', default: '', options: providers, size: 13 },
    { key: 'region', label: 'Region', type: 'select', default: '', options: regions, size: 13 },
    { key: 'distributor', label: 'Distributor', type: 'select', default: '', options: distributors, size: 35 },
    { key: 'edition', label: 'Edition', type: 'select', default: '', options: editions, size: 13 },
    { key: 'customEdition', label: 'Custom edition', type: 'text', default: '', size: 20 },
    // { key: 'seasonNumber', label: 'Season', type: 'text', default: '', size: 3 }, // Doesn't appear to be implemented via API
    // { key: 'episodeNumber', label: 'Episode', type: 'text', default: '', size: 3 },
    { key: 'tmdb', label: 'TMDB ID', type: 'text', default: '', size: 10 },
    { key: 'imdb', label: 'IMDB ID', type: 'text', default: '', size: 10 },
    { key: 'description', label: 'Description', type: 'multiline', default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}' },
    { key: 'mediainfo', label: 'MediaInfo', type: 'multiline', default: '{{ mediaInfo.fullText }}' },
    { key: 'nfo', label: 'NFO', type: 'multiline', default: '' },
    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },
    { key: 'live', label: 'Post live', type: 'checkbox', default: true },
    { key: 'sd', label: 'SD', type: 'checkbox', default: false },
    { key: 'pack', label: 'Season pack', type: 'checkbox', default: false },
    { key: 'special', label: 'Special', type: 'checkbox', default: false },
    { key: 'stream', label: 'Stream optimized', type: 'checkbox', default: false },
    { key: 'tag2in1', label: '2in1', type: 'checkbox', default: false },
    { key: 'tag2D3D', label: '2D/3D', type: 'checkbox', default: false },
    { key: 'tag3D', label: '3D', type: 'checkbox', default: false },
    { key: 'tag4kRemaster', label: '4K Restoration', type: 'checkbox', default: false },
    { key: 'tagCommentary', label: 'Commentary', type: 'checkbox', default: false },
    { key: 'tagDigitalExtras', label: 'Digital Extras', type: 'checkbox', default: false },
    { key: 'tagDualAudio', label: 'Dual Audio', type: 'checkbox', default: false },
    { key: 'tagDV', label: 'DV', type: 'checkbox', default: false },
    { key: 'tagEnglishDub', label: 'English Dub', type: 'checkbox', default: false },
    { key: 'tagExtras', label: 'Extras', type: 'checkbox', default: false },
    { key: 'tagHDR10', label: 'HDR10', type: 'checkbox', default: false },
    { key: 'tagHDR10P', label: 'HDR10+', type: 'checkbox', default: false },
    { key: 'tagHLG', label: 'HLG', type: 'checkbox', default: false },
    { key: 'tagHybrid', label: 'Hybrid', type: 'checkbox', default: false },
    { key: 'tagIncomplete', label: 'Incomplete', type: 'checkbox', default: false },
    { key: 'tagOpenMatte', label: 'Open Matte', type: 'checkbox', default: false },
    // { key: 'tagPart1', label: 'Pt 1', type: 'checkbox', default: false }, // Doesn't appear to be implemented via API
    // { key: 'tagPart2', label: 'Pt 2', type: 'checkbox', default: false },
    { key: 'tagPersonal', label: 'Personal Rip', type: 'checkbox', default: false },
    { key: 'tagScene', label: 'Scene', type: 'checkbox', default: false },
    { key: 'tagUpscale', label: 'Upscale', type: 'checkbox', default: false },
    { key: 'tagWEBDL', label: 'WEB-DL', type: 'checkbox', default: false },
    { key: 'tagWEBRip', label: 'WEBRip', type: 'checkbox', default: false },
] as const satisfies TrackerField[];

const layout = [
    ['name',          'name',        'name',        'name',          'name',          'name',             'name',          'name'],
    ['categoryId',    'categoryId',  'type',        'type',          'source',        'source',           'provider',      'provider'],
    ['region',        'region',      'distributor', 'distributor',   'distributor',   'distributor',      'edition',       'edition'],
    ['tmdb',          'tmdb',        'imdb',        'imdb',          'customEdition', 'customEdition',    'customEdition', 'customEdition'],
    ['tag2in1',       'tag2D3D',     'tag3D',       'tag4kRemaster', 'tagCommentary', 'tagDigitalExtras', 'tagDualAudio',  'tagDV'],
    ['tagEnglishDub', 'tagExtras',   'tagHDR10',    'tagHDR10P',     'tagHLG',        'tagHybrid',        'tagIncomplete', 'tagOpenMatte'],
    ['tagPersonal',   'tagScene',    'tagUpscale',  'tagWEBDL',      'tagWEBRip'],
    ['description',   'description', 'description', 'description',   'description',   'description',      'description',   'description'],
    ['mediainfo',     'mediainfo',   'mediainfo',   'mediainfo',     'mediainfo',     'mediainfo',        'mediainfo',     'mediainfo'],
    ['nfo',           'nfo',         'nfo',         'nfo',           'nfo',           'nfo',              'nfo',           'nfo'],
    ['sd', 'anonymous'],
    ['special', 'live'],
    ['pack'],
    ['stream'],
] as const satisfies TrackerLayout;

const BANNED_GROUPS = [
    'sicario', 'tommy', 'x0r', 'nikt0', 'fgt', 'd3g', 'megusta', 'yify',
    'tigole', 'tekno3d', 'c4k', 'rarbg', '4k4u', 'easports', 'realhd',
    'telly', 'aoc', 'wks', 'sasukeduck', 'crucible', 'flights', 'bitor',
    'ivy', 'qxr', 'syncup', 'oft', 'tgs', 'prores', 'mezrips',
];

export default class BeyondHD extends Tracker {

    override allowedImageHosts: string[] = ['ptpimg', 'imgbox', 'PiXhost', 'ImgBB'];
    apiKey: string = '';
    override name: string = 'BeyondHD';
    override data: FieldsToType<typeof fields>;
    override readonly fields = fields;
    override readonly layout = layout;
    source: string = 'BHD';

    constructor(settings: TrackerSettings) {

        super(settings);
        this.data = this.setDefaults(this.fields);

        if (!settings.apiKey) throw Error('API key is missing');
        this.apiKey = settings.apiKey;

        if (settings.defaultDescription) this.data.description = settings.defaultDescription;

    }

    applyMetadata(metadata: Metadata) {
        this.data.tmdb = String(metadata.tmdbId);
        this.data.imdb = metadata.imdbId ?? '';
    }

    applyRelease(release: Release) {

        if (release.category === 'tv') {
            this.setOption('categoryId', 'TV');
            //this.data.seasonNumber = release.season !== null ? String(release.season) : '';
            //this.data.episodeNumber = release.episode !== null ? String(release.episode) : '';
        } else if (release.category === 'movie') {
            this.setOption('categoryId', 'Movies');
        }

        if (release.remux) {
            if (release.resolution === '2160p') this.setOption('type', 'UHD Remux');
            else if (['480p', '480i', '576p', '576i'].includes(release.resolution ?? '')) this.setOption('type', 'DVD Remux');
            else this.setOption('type', 'BD Remux');
        } else if (release.resolution) {
            try { this.setOption('type', release.resolution); }
            catch { /* Some weird resolution */ }
        }

        // Source — BHD only has 5 values, derived from release.source

        if (release.source?.includes('HD-DVD')) {
            this.setOption('source', 'HD-DVD');
        } else if (release.source?.includes('WEB')) {
            this.setOption('source', 'WEB');
        } else if (release.source?.toLowerCase().includes('blu')) {
            this.setOption('source', 'Blu-ray');
        } else if (release.source === 'HDTV') {
            this.setOption('source', 'HDTV');
        } else if (release.source?.includes('DVD')) {
            this.setOption('source', 'DVD');
        }

        // Provider — streaming service, lowercase slug

        if (release.streamingService) {
            try { this.setOption('provider', release.streamingService); }
            catch { /* service not in BHD's list */ }
        }

        // Edition

        if (!release.edition) {
            if (release.censored === 'UNCUT') this.setOption('edition', 'Uncut');
            if (release.censored === 'UNRATED') this.setOption('edition', 'Unrated');
        }

        switch (release.edition) {
            case 'Extended':
                this.setOption('edition', 'Extended Cut');
                break;
            case "Collector's Edition":
            case "Director's Cut":
            case 'Limited Edition':
            case 'Special Edition':
            case 'Theatrical Cut':
                this.setOption('edition', release.edition);
                break;
            default:
                if (release.edition) this.data.customEdition = release.edition;
                break;
        }

        // Flags

        this.data.pack = release.isSeasonPack;
        this.data.special = release.isSpecial;
        if (release.resolution) this.data.sd = ['480p', '480i', '576p', '576i', '540p'].includes(release.resolution);

        // Tags

        if (release.multiAudio) this.data.tagDualAudio = true;
        if (release.dv) this.data.tagDV = true;

        if (release.hdr) {
            if (release.hdr.plus === 'HDR10+') this.data.tagHDR10P = true;
            else if (release.hdr.short === 'HLG') this.data.tagHLG = true;
            else this.data.tagHDR10 = true;
        }

        if (release.hybrid) this.data.tagHybrid = true;

        if (release.source?.includes('WEB-DL')) this.data.tagWEBDL = true;
        else if (release.source?.includes('WEBRip')) this.data.tagWEBRip = true;

        // Title

        const isWEB = release.source?.includes('WEB');
        const isRemux = release.remux;

        let titleFormat = '';

        if (release.category === 'tv') {
            titleFormat = '{title aka} {season_episode} {edition} {repack} {attributes} {resolution} {source} ';
        } else if (release.category === 'movie') {
            titleFormat = '{title aka} {year} {edition} {repack} {attributes} {resolution} {source} ';
        }

        if (isRemux) {
            titleFormat += '{remux} {video like_avc} {audio}';
        } else if (isWEB) {
            titleFormat += '{audio} {video like_h264}';
        } else if (release.resolution === '2160p') {
            // Encode — includes SDR tag for BluRay x265 without HDR
            titleFormat += '{audio} {video sdr encoder}';
        } else {
            titleFormat += '{audio} {video encoder}';
        }

        titleFormat += '-{group or_NOGROUP}';

        this.data.name = release.format(titleFormat);

    }

    override async validate() {

        if (!this.data.imdb) {
            throw Error('IMDb ID is required');
        }

        const group = this.release?.group?.toLowerCase();
        if (!group) return;

        if (BANNED_GROUPS.includes(group)) {
            throw Error(`Release group ${this.release!.group} is banned`);
        }

        if (group === 'ift' && this.release?.remux) {
            throw Error('iFT remuxes are banned (at the request of iFT)');
        }

        if (group === 'evo') {
            const source = this.release?.source ?? '';
            if (source.includes('BluRay') || source.includes('WEBRip')) {
                throw Error('EVO encodes (BluRay & WEBRip) are banned');
            }
        }

    }

    private assembleTags(): string {

        const tags: string[] = [];

        if (this.data.tag2in1) tags.push('2in1');
        if (this.data.tag2D3D) tags.push('2D3D');
        if (this.data.tag3D) tags.push('3D');
        if (this.data.tag4kRemaster) tags.push('4kRemaster');
        if (this.data.tagCommentary) tags.push('Commentary');
        if (this.data.tagDigitalExtras) tags.push('DigitalExtras');
        if (this.data.tagDualAudio) tags.push('DualAudio');
        if (this.data.tagDV) tags.push('DV');
        if (this.data.tagEnglishDub) tags.push('EnglishDub');
        if (this.data.tagExtras) tags.push('Extras');
        if (this.data.tagHDR10) tags.push('HDR10');
        if (this.data.tagHDR10P) tags.push('HDR10P');
        if (this.data.tagHLG) tags.push('HLG');
        if (this.data.tagHybrid) tags.push('Hybrid');
        if (this.data.tagIncomplete) tags.push('Incomplete');
        if (this.data.tagOpenMatte) tags.push('OpenMatte');
        // if (this.data.tagPart1) tags.push('Part1'); // Doesn't appear to be implemented via API
        // if (this.data.tagPart2) tags.push('Part2');
        if (this.data.tagPersonal) tags.push('Personal');
        if (this.data.tagScene) tags.push('Scene');
        if (this.data.tagUpscale) tags.push('Upscale');
        if (this.data.tagWEBDL) tags.push('WEBDL');
        if (this.data.tagWEBRip) tags.push('WEBRip');

        return tags.join(',');

    }

    async search(): Promise<TrackerSearchResults> {

        const url = new URL(SEARCH_URL(this.apiKey));
        url.searchParams.set('action', 'search');

        if (this.data.tmdb) {
            const category = this.data.categoryId === '1' ? 'movie' : 'tv';
            url.searchParams.set('tmdb_id', `${category}/${this.data.tmdb}`);
        }

        if (this.data.categoryId === '1') url.searchParams.set('categories', 'Movies');
        if (this.data.categoryId === '2') url.searchParams.set('categories', 'TV');

        if (this.data.type && this.data.type !== 'Other') {
            url.searchParams.set('types', this.data.type);
        }

        const features: string[] = [];
        if (this.data.tagDV) features.push('dv');
        if (this.data.tagHDR10) features.push('hdr10');
        if (this.data.tagHDR10P) features.push('hdr10+');
        if (features.length > 0) url.searchParams.set('features', features.join(','));

        const response = await fetch(url, { method: 'POST' });
        const body = await response.json();
        const validated = v.parse(SearchResultsSchema, body);

        return (validated.results ?? []).map(result => ({
            name: result.name,
            url: result.url,
        }));

    }

    protected override async upload(torrent: Blob, filename: string, signal: AbortSignal) {

        const formData = new FormData();

        formData.set('file', torrent, filename);

        const {
            name, description, mediainfo, nfo, tmdb, imdb, categoryId, type,
            source, provider, region, distributor, edition, customEdition,
            anonymous, live, sd, pack, special, stream
        } = this.data;

        // Required fields

        formData.set('name', name);
        formData.set('category_id', categoryId);
        formData.set('type', type);
        formData.set('source', source);
        formData.set('description', description);
        formData.set('mediainfo', new Blob([mediainfo], { type: 'text/plain' }), 'mediainfo');

        // TMDB — API wants movie/123 or tv/321 format
        if (tmdb) {
            const tmdbCategory = categoryId === '1' ? 'movie' : 'tv';
            formData.set('tmdb_id', `${tmdbCategory}/${tmdb}`);
        }

        // IMDB — validated in validate(), always present
        formData.set('imdb_id', imdb);

        // Optional fields

        if (provider) formData.set('provider', provider);
        if (region) formData.set('region', region);
        if (distributor) formData.set('distributor', distributor);
        if (edition) formData.set('edition', edition);
        if (customEdition) formData.set('custom_edition', customEdition);
        if (nfo) formData.set('nfo', new Blob([nfo], { type: 'text/plain' }), 'nfo');

        const tags = this.assembleTags();
        if (tags) formData.set('tags', tags);

        formData.set('anon', anonymous ? '1' : '0');
        formData.set('live', live ? '1' : '0');

        if (sd) formData.set('sd', '1');
        if (pack) formData.set('pack', '1');
        if (special) formData.set('special', '1');
        if (stream) formData.set('stream', '1');

        // Upload

        const response = await fetch(UPLOAD_URL(this.apiKey), {
            method: 'POST',
            body: formData,
            signal,
        });

        const body = await response.json();
        const validated = v.parse(UploadResponseSchema, body);

        if (!validated.success || validated.status_code === 0) {
            throw Error(validated.status_message);
        }

        // status_code 2 = live — status_message is the torrent download URL
        if (validated.status_code === 2) {
            return validated.status_message;
        }

        // status_code 1 = saved to drafts
        throw Error('Saved to drafts');

    }

}
