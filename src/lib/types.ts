import * as v from 'valibot';
import { torrentClients } from './server/torrent-clients';

export interface SettingsField {
    id: string;
    label: string;
    type: 'text' | 'url' | 'path' | 'password' | 'multiline' | 'spacer' | 'imageHosts';
    nameFilter?: string;
    description?: string;
    default?: string;
}

export interface SettingsOption {
    name: string,
    fields: SettingsField[],
}

export type Image = {
    page: string;
    image: string;
    thumbnail: string;
};

export type KeyValueData = [key: string, value: string][];

export type TrackerField = 
    | {
        key: string;
        label: string;
        type: 'text' | 'multiline';
        default: string;
        size?: number;
    } | {
        key: string;
        label: string;
        type: 'select';
        default: string;
        options: [ key: string, value: string ][];  // Required for select
        size?: number;
    } | {
        key: string;
        label: string;
        type: 'checkbox';
        default: boolean;
    };

export type TrackerLayout = (string | null)[][];

export type TrackerSearchResults = { name: string, url: string }[];

export interface TrackerSearchResultState {
    tracker: string;
    results: TrackerSearchResults;
    error?: string;
}

export interface TrackerStatusState {
    tracker: string;
    status: TrackerStatus;
}

type FieldValue<T> = T extends { type: 'checkbox' } ? boolean : string;

export type FieldsToType<T extends readonly TrackerField[]> = {
    [K in T[number]['key']]: FieldValue<Extract<T[number], { key: K }>>
};

export interface TmdbHydratedSearchResult {
    originCountry: string | null,
    originalLanguage: string,
    originalTitle: string,
    overview: string,
    year: number | null,
    title: string,
    genres: string[],
    posterUrl: string | null,
    tmdbId: number,
    imdbId: string | null,
    tvdbId: number | null,
    keywords: string[],
}

export type Metadata = TmdbHydratedSearchResult & { malId: number | null };

export const TrackerSettingsSchema = v.object({
    name: v.string(),
    announce: v.string(),
    imageHosts: v.array(v.string()),
    apiKey: v.optional(v.string()),
    defaultDescription: v.optional(v.string()),
});

export type TrackerSettings = v.InferOutput<typeof TrackerSettingsSchema>;

export const ImageHostSettingsSchema = v.object({
    name: v.string(),
    apiKey: v.optional(v.string()),
    server: v.optional(v.pipe(v.string(), v.url())),
});

export type ImageHostSettings = v.InferOutput<typeof ImageHostSettingsSchema>;

export const TorrentClientSettingsSchema = v.object({
    name: v.string(),
    url: v.optional(v.pipe(v.string(), v.url()))
})

export type TorrentClientSettings = v.InferOutput<typeof TorrentClientSettingsSchema>;

export const SettingsSchema = v.object({
    authToken: v.optional(v.string()),
    apiKey: v.fallback(v.nullable(v.string()), null),
    tmdbApiKey: v.fallback(v.string(), ''),
    contentFolder: v.optional(v.pipe(v.string(), v.transform(value => value === '' ? undefined : value))),
    imageHosts: v.fallback(v.array(ImageHostSettingsSchema), []),
    torrentClient: v.optional(TorrentClientSettingsSchema),
    trackers: v.fallback(v.array(TrackerSettingsSchema), []),
});

export type SettingsList = v.InferOutput<typeof SettingsSchema>;

export type TrackerFieldState = 
    | {
        id: string;
        label: string;
        type: 'text' | 'multiline';
        size?: number;
    } | {
        id: string;
        label: string;
        type: 'select';
        options: { id: string, label: string }[];  // Required for select
        size?: number;
    } | {
        id: string;
        label: string;
        type: 'checkbox';
    };

export type TrackerData = Record<string, string | boolean>;

export interface TrackerState {
    name: string,
    searchResults: TrackerSearchResults,
    status: string,
    data: TrackerData,
}

export interface TrackerFieldsState {
    name: string;
    fields: TrackerFieldState[];
    layout: TrackerLayout;
}

export type TrackerStatus = '' |
    '❌ Error' |
    '⏳ Waiting for MediaInfo and metadata' |
    '✏️ Ready to edit' |
    '🖼️ Uploading screenshots' |
    '📋 Preview done' |
    '🚦 Checking release' |
    '🧲 Making torrent' |
    '⬆️ Uploading torrent' |
    '⬇️ Downloading updated torrent' |
    '📤 Sending torrent to client' |
    '🎯 Checking for more options' |
    '✅ Done'
;

export interface TrackerErrorState {
    tracker: string,
    errors: string[],
};

export interface TrackerAfterUploadAction {
    label: string,
    action: () => Promise<void>,
};

export interface TrackerAfterUploadActionState {
    id: number,
    label: string,
}

export interface TrackersAfterUploadActionsState {
    tracker: string,
    actions: TrackerAfterUploadActionState[],
};

export type UploadsState = Array<{
    id: number,
    name: string,
    statusCounts: Record<TrackerStatus, number>,
}>;
    
export const ApiUploadSchema = v.object({
    contentPath: v.string(),
    tracker: v.string(),
    set: v.fallback(v.record(
        v.string(),
        v.union([v.boolean(), v.string()])
    ), {})
});