# Skill: Adding a New Tracker

## When to Use

Use this skill when the user asks to add support for a new torrent tracker.

## Overview

Trackers live in `src/lib/server/trackers/`. Each tracker is a single TypeScript file that extends the abstract `Tracker` base class from `src/lib/server/tracker.ts`. After creating the file, it must be registered in `src/lib/server/trackers/index.ts`.

Most trackers in this project are Unit3D-based. Use `src/lib/server/trackers/lst.ts` as the primary reference for Unit3D trackers, and `src/lib/server/trackers/aither.ts` as a secondary reference.

## Step-by-Step

### 1. Create the tracker file

Create `src/lib/server/trackers/<trackername>.ts` (lowercase). The file must export:

- **`default`** — the tracker class (extends `Tracker`)
- **`settings`** — a `SettingsField[]` array for the settings UI
- **`fields`** — a `TrackerField[]` array (with `as const satisfies TrackerField[]`) defining form fields

### 2. Register in index.ts

Add the tracker to `src/lib/server/trackers/index.ts`:

```typescript
import NewTracker, { settings as newtrackerSettings, fields as newtrackerFields } from './newtracker';

// Then add to the trackers record:
'NewTracker': { class: NewTracker, settings: newtrackerSettings, fields: newtrackerFields },
```

### 3. Run type checking

Run `bun run check` to verify the tracker compiles correctly.

## File Structure of a Tracker

Every tracker file follows this structure in order:

### Imports

```typescript
import type { FieldsToType, KeyValueData, SettingsField, TrackerField, TrackerSearchResults, TrackerSettings, TrackerAfterUploadAction, Metadata, TrackerLayout } from '$lib/types';
import * as v from 'valibot';
import type Release from '../release';
import Tracker from '../tracker';
import { unit3dDistributors, unit3dRegions } from './unit3d-distributors';
import { log } from '../util/log';
import errorString from '../util/error-string';
import { TTLCache } from '@isaacs/ttlcache';
import pMemoize from 'p-memoize';
```

Only import `unit3d-distributors` if the tracker is Unit3D-based.

### URL Constants

Define API endpoint URLs as module-level constants:

```typescript
const UPLOAD_URL = 'https://example.com/api/torrents/upload';
const SEARCH_URL = 'https://example.com/api/torrents/filter';
const BANNED_GROUPS_URL = 'https://example.com/api/bannedReleaseGroups';
```

### Valibot Schemas

Define response validation schemas near the top, before the data arrays:

```typescript
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
```

### KeyValueData Arrays

Define `categories`, `types`, `resolutions`, and any tracker-specific option arrays as `KeyValueData` (which is `[key: string, value: string][]`). The first element is the API ID, the second is the display label:

```typescript
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
    ['6', '576p'],
    ['7', '576i'],
    ['8', '480p'],
    ['9', '480i'],
    ['10', 'Other'],
];
```

These values are tracker-specific — check the tracker's API or upload page for the correct IDs and labels.

### Settings Export

The `settings` export defines what appears in the app's Settings page for this tracker. Common fields:

```typescript
export const settings: SettingsField[] = [
    {
        id: 'announce',
        label: 'Announce URL',
        type: 'password',
        description: 'You can find your announce URL on the <a href="https://example.com/upload">upload page</a>.',
    }, {
        id: 'apiKey',
        label: 'API key',
        type: 'password',
        description: 'Your API key can be found in your profile settings.',
    }, {
        id: 'defaultDescription',
        label: 'Default description',
        type: 'multiline',
        default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}',
    }
];
```

### Fields Export

The `fields` export defines the upload form fields. It MUST use `as const satisfies TrackerField[]` for type inference. Each field has:

- **`key`** — unique camelCase identifier, used in `this.data` and the API (e.g. `categoryId`, `seasonNumber`, `personalRelease`)
- **`label`** — display name in the UI
- **`type`** — `'text'`, `'multiline'`, `'select'`, or `'checkbox'`
- **`default`** — default value (string for text/multiline/select, boolean for checkbox). For select fields, the default is matched by the **display label** (second element of the KeyValueData tuple), not the key
- **`options`** — required for select fields, a `KeyValueData` array
- **`size`** — optional, controls UI width

Standard fields most trackers have:

```typescript
export const fields = [
    { key: 'name', label: 'Title', type: 'text', default: '' },
    { key: 'categoryId', label: 'Category', type: 'select', default: 'Movies', options: categories, size: 13 },
    { key: 'typeId', label: 'Type', type: 'select', default: 'Other', options: types, size: 13 },
    { key: 'resolutionId', label: 'Resolution', type: 'select', default: 'Other', options: resolutions, size: 13 },
    { key: 'seasonNumber', label: 'Season', type: 'text', default: '', size: 3 },
    { key: 'episodeNumber', label: 'Episode', type: 'text', default: '', size: 3 },
    { key: 'tmdb', label: 'TMDB ID', type: 'text', default: '', size: 10 },
    { key: 'imdb', label: 'IMDB ID', type: 'text', default: '', size: 10 },
    { key: 'tvdb', label: 'TVDB ID', type: 'text', default: '', size: 10 },
    { key: 'mal', label: 'MAL ID', type: 'text', default: '', size: 10 },
    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'multiline', default: '{% screenshots width:350 %}[url={{page}}][img=350]{{thumbnail}}[/img][/url]{% endscreenshots %}' },
    { key: 'mediainfo', label: 'MediaInfo', type: 'multiline', default: '{{ mediaInfo.fullText }}' },
    { key: 'bdinfo', label: 'BDInfo', type: 'multiline', default: '' },
    { key: 'anonymous', label: 'Anonymous', type: 'checkbox', default: false },
    { key: 'free', label: 'Freeleech', type: 'select', default: 'No Freeleech', options: frees, size: 16 },
] as const satisfies TrackerField[];
```

### Layout

The `layout` defines a 2D grid for UI rendering. Each row is an array of field keys (or `null` for empty cells). Repeating a key across columns makes it span multiple columns:

```typescript
const layout = [
    ['name',          'name',          'name',         'name'],
    ['categoryId',    'typeId',        'resolutionId'],
    ['seasonNumber',  'episodeNumber'],
    ['tmdb',          'imdb',          'tvdb',         'mal'],
    ['keywords',      'keywords',      'keywords',     'keywords'],
    ['description',   'description',   'description',  'description'],
    ['mediainfo',     'mediainfo',     'mediainfo',    'mediainfo'],
    ['bdinfo',        'bdinfo',        'bdinfo',       'bdinfo'],
    ['anonymous',     'free'],
] as const satisfies TrackerLayout;
```

### The Tracker Class

```typescript
export default class NewTracker extends Tracker {

    apiKey: string = '';
    override name: string = 'NewTracker';
    override data: FieldsToType<typeof fields>;
    override readonly fields = fields;
    override readonly layout = layout;
    source: string = 'NewTracker';

    constructor(settings: TrackerSettings) {
        super(settings);
        this.data = this.setDefaults(this.fields);
        if (!settings.apiKey) throw Error('API key is missing for NewTracker');
        this.apiKey = settings.apiKey;
        if (settings.defaultDescription) this.data.description = settings.defaultDescription;
    }
```

Required properties:
- **`name`** — display name
- **`data`** — typed as `FieldsToType<typeof fields>`, initialized via `this.setDefaults(this.fields)`
- **`fields`** — must be `override readonly` referencing the exported `fields`
- **`layout`** — must be `override readonly` referencing the `layout` constant
- **`source`** — string used as metadata in generated torrents

### Required Methods

#### `applyMetadata(metadata: Metadata)`

Populates tracker fields from TMDB/MAL data. Standard implementation for Unit3D trackers (note: Unit3D expects the IMDb ID as a bare number — the `tt` prefix must be stripped):

```typescript
applyMetadata(metadata: Metadata) {
    this.data.tmdb = String(metadata.tmdbId);
    this.data.imdb = metadata.imdbId ? metadata.imdbId.replace(/^tt/i, '') : '0';
    this.data.tvdb = metadata.tvdbId ? String(metadata.tvdbId) : '0';
    this.data.mal = metadata.malId ? String(metadata.malId) : '0';
    this.data.keywords = metadata.keywords.join(', ');
}
```

#### `applyRelease(release: Release)`

Auto-populates fields from parsed release info. This method should:

1. Set resolution via `this.setOption('resolutionId', release.resolution)`
2. Determine and set the type (Full Disc, Remux, Encode, WEB-DL, WEBRip, HDTV)
3. Set category (Movie vs TV)
4. Set season/episode numbers for TV
5. Set HDR/DV flags if applicable
6. Build a title format string and call `release.format(titleFormat)`

Use `this.setOption(fieldKey, displayValue)` to set select fields by their display label (not their key ID).

**Title format tokens** (used in `release.format()`):
- `{title}`, `{title aka}` — release title, optionally with AKA
- `{year}` — release year
- `{season_episode}` — e.g. `S01E05`
- `{season_or_episode_title}` — episode title if available
- `{edition}` — edition info (Director's Cut, etc.)
- `{language}`, `{language if_not_dual_audio}` — language tag
- `{attributes}` — misc attributes (Hybrid, etc.)
- `{repack}` — REPACK/PROPER tag
- `{resolution}` — e.g. `1080p`
- `{source}` — e.g. `BluRay`, `WEB-DL`
- `{audio}` — short audio codec name (e.g. `DDP`, `TrueHD`)
- `{audio plus}` — expanded audio codec name (e.g. `DD+`, `TrueHD Atmos`) with Atmos/channels
- `{video}`, `{video like_h264}`, `{video like_avc}`, `{video encoder}` — video codec in various formats
- `{remux}` — "REMUX" tag
- `{group}` — release group name

Title format is built conditionally based on category and type. Standard pattern:

```typescript
let titleFormat = '';

if (release.category === 'tv') {
    this.setOption('categoryId', 'TV');
    this.data.seasonNumber = release.season ? String(release.season) : '0';
    this.data.episodeNumber = release.episode ? String(release.episode) : '0';
    titleFormat = '{title aka} {season_episode} {edition} {attributes} {repack} {resolution} {source} ';
} else if (release.category === 'movie') {
    this.setOption('categoryId', 'Movies');
    titleFormat = '{title aka} {year} {edition} {attributes} {repack} {resolution} {source} ';
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
```

#### `search(): Promise<TrackerSearchResults>`

Searches the tracker for existing torrents matching the current data. Returns an array of `{ name: string, url: string }`. Standard Unit3D implementation uses the filter API with category, resolution, type, and season/episode params.

#### `upload(torrent: Blob, filename: string, signal: AbortSignal): Promise<void | string | Response>`

Performs the actual HTTP upload. Must:

1. Build a `FormData` with the torrent file and all field values
2. POST to the upload endpoint with auth headers
3. Parse and validate the response
4. Return one of:
   - `void` — upload complete, no torrent file to download
   - `string` (URL) — URL to download the updated torrent file from
   - `Response` — a fetch Response for the updated torrent file

For Unit3D trackers, the upload endpoint returns `{ success: true, data: "<url>" }` on success. Error handling should check for structured error responses:

```typescript
if (!response.ok || !body.success) {
    const ErrorSchema = v.record(v.string(), v.array(v.string()));
    const errors = v.safeParse(ErrorSchema, body.data);
    if (errors.success) {
        const flattenedErrors = Object.values(errors.output).flat().join(' ');
        throw Error(flattenedErrors);
    }
    throw Error(body.message ?? response.statusText);
}
```

### Optional Methods

#### `validate(): Promise<void>`

Override to add pre-upload checks. Must not mutate data — throw an `Error` to prevent upload. Common uses:

- **Banned group checks** — fetch and check against the tracker's banned groups list
- **Required metadata** — some trackers require an IMDb ID
- **Internal claims** — some trackers have shows claimed by internal groups that only internals can upload

#### `getAfterUploadActions(signal: AbortSignal): Promise<TrackerAfterUploadAction[]>`

Override to provide post-upload actions like trumping reports. Each action has a `label` (displayed in UI) and an `action` (async function executed when clicked).

### Banned Groups (Optional)

If the tracker has a banned groups API, follow this pattern:

1. Create a `TTLCache` at module level (1 hour TTL)
2. Use `pMemoize` to wrap the fetch function with the cache
3. Implement `_getBannedGroups()` that fetches and validates the list
4. Call from `validate()`

### Auth Headers

Unit3D trackers use Bearer token auth:

```typescript
private get headers(): Headers {
    return new Headers({
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
    });
}
```

## Key Patterns

- **Use `this.setOption(key, displayLabel)`** to set select fields by display value, not raw ID
- **Use `this.getOption(key)`** to get the current display label of a select field
- **Use `this.setDefaults(this.fields)`** in the constructor to initialize `this.data`
- **Validate all API responses** with Valibot schemas
- **Use `errorString()`** for error context: `throw Error(errorString("Couldn't upload", error))`
- **Use `log()`** for logging with appropriate colors
- **FormData boolean fields** are sent as `'1'` or `'0'` strings
- **Optional FormData fields** — only append if the value is truthy
- **Avoid abbreviations** — use `response` not `res`, `formData` not `fd`