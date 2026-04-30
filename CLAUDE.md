# AK Automated Uploader

A SvelteKit + Bun web app for uploading releases to private torrent trackers. It handles torrent creation, screenshot extraction, metadata lookup (TMDB/MAL), image hosting, and multi-tracker submission through a UI and a REST API.

## Tech Stack

- **Runtime**: Bun (not Node.js — use Bun APIs where available)
- **Framework**: SvelteKit v2 with Svelte v5
- **Language**: TypeScript in strict mode
- **Validation**: Valibot (not Zod)
- **Templates**: LiquidJS (torrent page descriptions)

## Running Locally

```bash
bun install
bun run dev
```

External binaries must be on PATH: `ffmpeg`, `ffprobe`, `mkbrr`.

## Building

```bash
bun run build
ORIGIN=http://localhost:51901 PORT=51901 bun build/index.js
```

## Project Structure

```
src/lib/server/
  tracker.ts           # Abstract base class all trackers extend
  release.ts           # Parses filenames into structured metadata, some methods accept MediaInfo data
  upload.ts            # Orchestrates the full upload workflow
  mediainfo.ts         # Shells out to mediainfo CLI
  screenshots.ts       # Shells out to ffmpeg/ffprobe
  torrent.ts           # Shells out to mkbrr
  tmdb.ts              # TMDB API client
  jikan.ts             # MyAnimeList (Jikan) API client
  settings.ts          # Singleton settings; persisted to $APPDATA
  upload-screenshots.ts
  send-torrent.ts
  trackers/            # One file per tracker
  image-hosts/         # One file per image host
  torrent-clients/     # One file per torrent client
  util/                # log.ts, error-string.ts, etc.
src/routes/
  api/upload/          # POST /api/upload
  api/preview/         # POST /api/preview
  uploads/             # Main UI
  settings/            # Settings UI
```

## Key Concepts

### Release

`Release` (`src/lib/server/release.ts`) parses a torrent filename into structured fields: title, year, season/episode, resolution, codec, HDR format, audio, source, group, etc. It also has a `format(template)` method used by trackers to generate titles with `{field}` tokens. When modifying release parsing, be careful — the regex patterns match backwards from the end of the filename.

### Tracker

`Tracker` (`src/lib/server/tracker.ts`) is an abstract base class. Concrete implementations live in `src/lib/server/trackers/`. Each tracker defines:

- `fields` — static `as const satisfies TrackerField[]` array defining the form fields
- `layout` — 2D grid spec for UI rendering
- `data` — runtime state typed via `FieldsToType<typeof this.fields>`
- `source` — source attribution string, used as a metadata flag in generated torrents
- `applyMetadata(metadata)` — populates tracker fields from TMDB/MAL data
- `applyRelease(release)` — auto-populates category, type, resolution, etc. from Release
- `upload()` — does the actual HTTP upload to the tracker's API, should return `Promise<void>` or if the tracker generates a torrent file, a `Promise<string>` of its URL or a `Promise<Response>` of a fetch to the torrent file

Status transitions during upload follow emoji strings defined in `TrackerStatus` in `types.ts`.

### Adding a New Tracker

1. Create `src/lib/server/trackers/yourtracker.ts` — extend `Tracker`, export the class as default plus `settings` and `fields` named exports.
2. Register it in `src/lib/server/trackers/index.ts` — add an entry to the `trackers` record.
3. Look at `lst.ts` as a solid reference as a base for most Unit3D trackers

### Image Hosts

Extend the `ImageHost` base class in `src/lib/server/image-hosts/`. Register in `src/lib/server/image-hosts/index.ts`. Each host must implement `upload(image: Blob): Promise<Image>` where `Image = { page, image, thumbnail }`.

### Settings

`settings.ts` is a singleton. Access via `settings.all()`, `settings.get('key')`, `settings.set(patch)`. It persists to:
- Windows: `%APPDATA%/ak-automated-uploader/settings.json`
- macOS: `~/Library/Preferences/ak-automated-uploader/settings.json`
- Linux: `~/.local/share/ak-automated-uploader/settings.json`

## Patterns to Follow

**Validation**: Use Valibot (`import * as v from 'valibot'`) for all external input validation. Define schemas near the code that uses them.

**Error messages**: Use the `errorString()` utility. It's used to add human-readable context to any error message, and return a string. `catch (error) { throw Error(errorString("Couldn't upload torrent", error)); }` would include a flattened Valibot error for example, or `error.message` from an `Error`, or just pass through a string.

**Logging**: Use `log()` from `src/lib/server/util/log.ts`. First argument is a color (`'tomato'`: fatal error, `'khaki'`: warning, `'aquamarine'`: success, `'lightgrey'`: note).

**Async**: Follow the existing patterns — `AbortSignal` for cancellation, `PQueue` for concurrency control. Don't add new unbounded concurrency.

**Types**: Prefer `import type` for type-only imports (Svelte 5 requirement). New shared types belong in `src/lib/types.ts`.

**Abbreviation**: Avoid abbreviation unless it's for standard terms. Bad: `const res = await fetch`, good: `const response = await fetch`, however `cacheTTL`, `toJSON`, etc are acceptable.

**No comments by default**: Only add a comment if the *why* is genuinely non-obvious. Don't narrate what the code does.

## No Tests

There are no automated tests in this codebase. Type checking (`bun run check`) and manual testing are the current verification methods. Don't add a test framework without discussing it first.
