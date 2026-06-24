import type { FieldsToType, KeyValueData, SettingsField, TrackerField, TrackerSearchResults, TrackerSettings, TrackerAfterUploadAction, Metadata, TrackerLayout } from '$lib/types';
import * as v from 'valibot';
import type Release from '../release';
import Tracker from '../tracker';
import { unit3dDistributors, unit3dRegions } from './unit3d-distributors';
import { log } from '../util/log';
import errorString from '../util/error-string';

const BASE_URL = 'https://midnightscene.cc';
const UPLOAD_URL = `${BASE_URL}/api/torrents/upload`;
const SEARCH_URL = `${BASE_URL}/api/torrents/filter`;

const SearchResultsSchema = v.object({
    data: v.array(v.object({
        id: v.string(),
        attributes: v.object({
            name: v.string(),
            details_link: v.pipe(v.string(), v.url()),
        }),
    })),
});

export const categories: KeyValueData = [
    ['1', 'Movie'],
    ['2', 'TV'],
];

export const types: KeyValueData = [
    ['1', 'DISC'],
    ['2', 'REMUX'],
    ['3', 'ENCODE'],
    ['4', 'WEBDL'],
    ['5', 'WEBRIP'],
    ['6', 'HDTV'],
];

export const resolutions: KeyValueData = [
    ['1', '4320p'],
    ['2', '2160p'],
    ['3', '1080p'],
    ['4', '1080i'],
    ['5', '720p'],
];

export const regions: KeyValueData = unit3dRegions;
export const distributors: KeyValueData = unit3dDistributors;

export const settings: SettingsField[] = [   
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'You can find your announce URL on the <a href="https://midnightscene.cc/torrents/create">upload page</a>.',
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
    { key: 'typeId', label: 'Type', type: 'select', default: 'ENCODE', options: types, size: 13 },
    { key: 'resolutionId', label: 'Resolution', type: 'select', default: '1080p', options: resolutions, size: 13 },
    { key: 'distributorId', label: 'Distributors', type: 'select', default: '', options: distributors, size: 35 },
    { key: 'regionId', label: 'Regions', type: 'select', default: '', options: regions, size: 13 },
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
    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },
    { key: 'internal', label: 'Internal', type: 'checkbox', default: false },
    { key: 'modQueueOptIn', label: 'Opt in to mod queue', type: 'checkbox', default: false },
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
    ['anonymous',     'internal',        'modQueueOptIn'],
] as const satisfies TrackerLayout;

export default class MidnightScene extends Tracker {
    apiKey: string = '';
    override name: string = 'MidnightScene';
    override data: FieldsToType<typeof fields>;
    override readonly fields = fields;
    override readonly layout = layout;
    source: string = 'MNS';

    constructor(settings: TrackerSettings) {
        super(settings);
        this.data = this.setDefaults(this.fields);
        if (!settings.apiKey) throw Error('API key is missing for MidnightScene');
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
        this.data.keywords = (metadata.keywords || []).join(', ');
    }

    applyRelease(release: Release) {
        if (release.resolution) this.setOption('resolutionId', release.resolution);

        if (release.fullDisc) {
            this.setOption('typeId', 'DISC');
        } else if (release.remux) {
            this.setOption('typeId', 'REMUX');
        } else if (release.source === 'BluRay' || release.source === 'DVDRip') {
            this.setOption('typeId', 'ENCODE');
        } else if (release.source?.endsWith('WEB-DL')) {
            this.setOption('typeId', 'WEBDL');
        } else if (release.source?.endsWith('WEBRip')) {
            this.setOption('typeId', 'WEBRIP');
        } else if (release.source === 'HDTV') {
            this.setOption('typeId', 'HDTV');
        }

        let titleFormat = '';
        if (release.category === 'tv') {
            this.setOption('categoryId', 'TV');
            this.data.seasonNumber = release.season ? String(release.season) : '0';
            this.data.episodeNumber = release.episode ? String(release.episode) : '0';
            titleFormat = '{title aka} {season_episode} {edition} {repack} {resolution} {source} {audio plus} {video like_h264}';
        } else {
            this.setOption('categoryId', 'Movie');
            titleFormat = '{title aka} {year} {edition} {repack} {resolution} {source} {audio plus} {video like_h264}';
        }

        titleFormat += '-{group}';
        this.data.name = release.format(titleFormat);
    }

    async search(): Promise<TrackerSearchResults> {
        const url = new URL(SEARCH_URL);
        url.searchParams.append('tmdbId', this.data.tmdb);
        url.searchParams.append('categories[]', this.data.categoryId);
        
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

        const {
            name, description, mediaInfo, bdInfo, keywords, seasonNumber,
            episodeNumber, tmdb, imdb, tvdb, mal, categoryId, typeId,
            resolutionId, regionId, distributorId, anonymous, internal, modQueueOptIn
        } = this.data;

        formData.set('name', name);
        formData.set('description', description);
        formData.set('mediainfo', mediaInfo);
        formData.set('bdinfo', bdInfo);
        formData.set('category_id', categoryId);
        formData.set('type_id', typeId);
        formData.set('resolution_id', resolutionId);
        formData.set('tmdb', tmdb || '0');
        formData.set('imdb', imdb || '0');
        formData.set('tvdb', tvdb || '0');
        formData.set('mal', mal || '0');
        formData.set('igdb', '0');
        formData.set('anonymous', anonymous ? '1' : '0');
        formData.set('internal', internal ? '1' : '0');
        
        if (modQueueOptIn) formData.set('mod_queue_opt_in', '1');
        if (categoryId === '2') {
            formData.set('season_number', seasonNumber);
            formData.set('episode_number', episodeNumber);
        }
        if (regionId) formData.set('region_id', regionId);
        if (distributorId) formData.set('distributor_id', distributorId);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: this.headers,
            body: formData,
            signal,
        });
        
        const body = await response.json();
        if (!response.ok || !body.success) throw Error(body.message ?? response.statusText);

        return v.parse(v.object({ data: v.pipe(v.string(), v.url())}), body).data;
    }
}
