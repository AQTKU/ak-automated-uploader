import type {
    FieldsToType,
    KeyValueData,
    SettingsField,
    TrackerField,
    TrackerSettings,
    TrackerSearchResults,
    Metadata,
} from '$lib/types';

import * as v from 'valibot';
import type Release from '../release';
import Tracker from '../tracker';
import { unit3dDistributors, unit3dRegions } from './unit3d-distributors';

const BASE = 'https://midnightscene.cc';
const UPLOAD_URL = `${BASE}/api/torrents/upload`;
const SEARCH_URL = `${BASE}/api/torrents/filter`;

const categories: KeyValueData = [
    ['1', 'Movies'],
    ['2', 'TV'],
];

const types: KeyValueData = [
    ['1', 'Full Disc'],
    ['2', 'Remux'],
    ['3', 'Encode'],
    ['4', 'WEB-DL'],
    ['5', 'WEBRip'],
    ['6', 'HDTV'],
    ['7', 'Other'],
];

const resolutions: KeyValueData = [
    ['1', '4320p'],
    ['2', '2160p'],
    ['3', '1080p'],
    ['4', '1080i'],
    ['5', '720p'],
    ['10', 'Other'],
];

export const settings: SettingsField[] = [
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'Find your announce URL on the upload page.',
    },
    {
        id: 'apiKey',
        label: 'API key',
        type: 'password',
        description: 'Your API key is in your profile settings.',
    },
    {
        id: 'defaultDescription',
        label: 'Default description',
        type: 'multiline',
        default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}',
    },
];

export const fields = [
    { key: 'name', label: 'Title', type: 'text', default: '' },

    { key: 'categoryId', label: 'Category', type: 'select', default: '1', options: categories },

    { key: 'typeId', label: 'Type', type: 'select', default: '7', options: types },

    { key: 'resolutionId', label: 'Resolution', type: 'select', default: '10', options: resolutions },

    { key: 'provider', label: 'Provider', type: 'text', default: '' },

    { key: 'distributorId', label: 'Distributor', type: 'select', default: '', options: unit3dDistributors },

    { key: 'regionId', label: 'Region', type: 'select', default: '', options: unit3dRegions },

    { key: 'seasonNumber', label: 'Season', type: 'text', default: '' },

    { key: 'episodeNumber', label: 'Episode', type: 'text', default: '' },

    { key: 'tmdb', label: 'TMDB ID', type: 'text', default: '' },

    { key: 'imdb', label: 'IMDB ID', type: 'text', default: '' },

    { key: 'tvdb', label: 'TVDB ID', type: 'text', default: '' },

    { key: 'mal', label: 'MAL ID', type: 'text', default: '' },

    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },

    {
        key: 'description',
        label: 'Description',
        type: 'multiline',
        default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}',
    },

    { key: 'mediainfo', label: 'MediaInfo', type: 'multiline', default: '' },

    { key: 'bdinfo', label: 'BDInfo', type: 'multiline', default: '' },

    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },

    { key: 'personalRelease', label: 'Personal release', type: 'checkbox', default: false },

    { key: 'modQueueOptIn', label: 'Opt in to mod queue', type: 'checkbox', default: false },

    { key: 'draftQueueOptIn', label: 'Save as draft', type: 'checkbox', default: false },

    { key: 'internal', label: 'Internal', type: 'checkbox', default: false },

    { key: 'refundable', label: 'Refundable', type: 'checkbox', default: false },

] as const satisfies TrackerField[];

export default class MNS extends Tracker {

    apiKey = '';

    override name = 'MNS';

    override data: FieldsToType<typeof fields>;

    override readonly fields = fields;

    constructor(settings: TrackerSettings) {

        super(settings);

        this.data = this.setDefaults(this.fields);

        this.apiKey = settings.apiKey ?? '';

        if (settings.defaultDescription) {
            this.data.description = settings.defaultDescription;
        }

    }

    private get headers(): Headers {

        return new Headers({
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        });

    }

    applyMetadata(metadata: Metadata) {

        this.data.tmdb = String(metadata.tmdbId);

        this.data.imdb = metadata.imdbId
            ? metadata.imdbId.replace(/^tt/i, '')
            : '0';

        this.data.tvdb = metadata.tvdbId
            ? String(metadata.tvdbId)
            : '0';

        this.data.mal = metadata.malId
            ? String(metadata.malId)
            : '0';

        this.data.keywords = metadata.keywords.join(', ');

    }

    applyRelease(release: Release) {

        this.setOption('resolutionId', '10');

        if (release.resolution) {
            this.setOption('resolutionId', release.resolution);
        }

        this.setOption('typeId', '7');

        if (release.fullDisc) {

            this.setOption('typeId', '1');

        } else if (release.remux) {

            this.setOption('typeId', '2');

        } else if (
            release.source === 'BluRay' ||
            release.source === 'DVDRip'
        ) {

            this.setOption('typeId', '3');

        } else if (release.source?.endsWith('WEB-DL')) {

            this.setOption('typeId', '4');

        } else if (release.source?.endsWith('WEBRip')) {

            this.setOption('typeId', '5');

        } else if (release.source === 'HDTV') {

            this.setOption('typeId', '6');

        }

        if (release.category === 'tv') {

            this.setOption('categoryId', '2');

            this.data.seasonNumber = release.season
                ? String(release.season)
                : '0';

            this.data.episodeNumber = release.episode
                ? String(release.episode)
                : '0';

        } else {

            this.setOption('categoryId', '1');

        }

        if (release.streamingService) {
            this.data.provider = release.streamingService;
        }

        this.data.name = release.format(
            '{title aka} {year} {resolution} {source} {audio} {video} -{group}'
        );

    }

    async search(): Promise<TrackerSearchResults> {

        const url = new URL(SEARCH_URL);

        const params = url.searchParams;

        params.append('tmdbId', this.data.tmdb);

        params.append('categories[]', this.data.categoryId);

        params.append('resolutions[]', this.data.resolutionId);

        params.append('types[]', this.data.typeId);

        const response = await fetch(url, {
            headers: this.headers,
        });

        const body = await response.json();

        const validated = v.parse(
            v.object({
                data: v.array(
                    v.object({
                        id: v.string(),
                        attributes: v.object({
                            name: v.string(),
                            details_link: v.pipe(v.string(), v.url()),
                        }),
                    })
                ),
            }),
            body
        ).data;

        return validated.map(result => ({
            name: result.attributes.name,
            url: result.attributes.details_link,
        }));

    }

    override async validate() {
        return;
    }

}
