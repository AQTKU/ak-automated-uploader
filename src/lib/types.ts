import z from 'zod';

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

export const TrackerSettingsSchema = z.object({
    name: z.string(),
    announce: z.string(),
    imageHosts: z.array(z.string()),
    apiKey: z.string().optional(),
    defaultDescription: z.string().optional(),
});

export type TrackerSettings = z.infer<typeof TrackerSettingsSchema>;

export const ImageHostSettingsSchema = z.object({
    name: z.string(),
    apiKey: z.string().optional(),
});

export type ImageHostSettings = z.infer<typeof ImageHostSettingsSchema>;

export const TorrentClientSettingsSchema = z.object({
    name: z.string(),
    url: z.url().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
});

export type TorrentClientSettings = z.infer<typeof TorrentClientSettingsSchema>;

export const SettingsSchema = z.object({
    authToken: z.string().optional(),
    apiKey: z.string().nullable().default(null),
    tmdbApiKey: z.string().default(''),
    contentFolder: z.string().transform(value => value === '' ? undefined : value).optional(),
    imageHosts: z.array(ImageHostSettingsSchema).default([]),
    torrentClient: TorrentClientSettingsSchema.optional(),
    trackers: z.array(TrackerSettingsSchema).default([]),
});

export type SettingsList = z.infer<typeof SettingsSchema>;

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