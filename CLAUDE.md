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
src/lib/server/        # Most base classes and models
  trackers/            # One file per tracker
  image-hosts/         # One file per image host
  torrent-clients/     # One file per torrent client
  util/                # log.ts, error-string.ts, etc.
src/routes/
  api/                 # Upload API and its documentation
  uploads/             # Main UI
  settings/            # Settings UI
```

## Key Concepts

When a file is selected, a new `Upload` is created. A `Release` is created which parses the filename into structured fields: title, year, season/episode, resolution, codec, etc. A `MediaInfo` is created that updates that information. `Tmdb` is searched and matched against a title found in the release which produces a `Metadata`. This information is given to `Trackers`, which contains every torrent tracker the user has configured, and delivers the objects to each `Tracker`.

### Tracker

`Tracker` (`src/lib/server/tracker.ts`) is an abstract base class. Concrete implementations live in `src/lib/server/trackers/`. Each tracker defines:

- `fields` — static `as const satisfies TrackerField[]` array defining the form fields
- `layout` — 2D grid spec for UI rendering
- `data` — runtime state typed via `FieldsToType<typeof this.fields>`
- `source` — source attribution string, used as a metadata flag in generated torrents
- `applyMetadata(metadata)` — populates tracker fields from TMDB/MAL data
- `applyRelease(release)` — auto-populates category, type, resolution, etc. from Release
- `upload()` — does the actual HTTP upload to the tracker's API, should return `Promise<void>` or if the tracker generates a torrent file, a `Promise<string>` of its URL or a `Promise<Response>` of a fetch to the torrent file

### Adding a New Tracker

1. Create `src/lib/server/trackers/yourtracker.ts` — extend `Tracker`, export the class as default plus `settings` and `fields` named exports.
2. Register it in `src/lib/server/trackers/index.ts` — add an entry to the `trackers` record.
3. Look at `lst.ts` as a solid reference as a base for most Unit3D trackers

## Patterns to Follow

**Validation**: Use Valibot (`import * as v from 'valibot'`) for all external input validation. Define schemas near the code that uses them, or in `src/lib/types.ts` for schemas that appear in multiple locations (rare).

**Logging**: Use `log()` from `src/lib/server/util/log.ts`. Second argument is a color (`'tomato'`: fatal error, `'khaki'`: warning, `'aquamarine'`: success, `'lightgrey'` or omit: note).

**Async**: Follow the existing patterns — `AbortSignal` for cancellation, `PQueue` for concurrency control. Don't add new unbounded concurrency.

**Types**: Prefer `import type` for type-only imports (Svelte 5 requirement). New shared types belong in `src/lib/types.ts`.

**Abbreviation**: Avoid abbreviation except for standard terms. Bad: `const res = await fetch`, good: `const response = await fetch`, however `cacheTTL`, `toJSON`, etc are acceptable.

**No comments by default**: Only add a comment if the *why* is genuinely non-obvious. Don't narrate what the code does.

### Error Messages

Use the `errorString()` utility. It's used to add human-readable context to any error message, and return a string. `catch (error) { throw Error(errorString("Couldn't upload torrent", error)); }` would include a flattened Valibot error for example, or `error.message` from an `Error`, or just pass through a string.

Assume all written error messages will be read by a user. Use short, plain language in a neutral tone.

Good: "Couldn't upload torrent" - Short, clear, the why will follow from `errorString()`
OK: "Failed to upload torrent" - "Failed to" is very Windows 95
Bad: "Torrent upload couldn't proceed due to an error during `submit()`" - Detail that's useless to the user, too wordy, too technical

### Plurals in Names

Plurals generally refer to collections or containers. An `Upload` is managed by `Uploads`. `ImageHost`'s base class is defined in `src/lib/server/image-host.ts`, and its implementations are kept in `src/lib/server/image-hosts`. This pattern repeats across the codebase.

## Tests

Coverage is deliberately narrow. `Release` is tested (`src/lib/server/release.test.ts`) because it's pure, self-contained and full of parsing edge cases. Everything else — trackers, image hosts, torrent clients — talks to the network or shells out, and is verified by type checking (`bun run check`) and manual testing.

```bash
bun test
```

Use Bun's built-in runner and don't add tests that need network access or external binaries without discussing it first.

## Banned Trackers

Some trackers ban the use of AI, and require AI agents not learn their API surface. Do not attempt to access these tracker definitions:

- src/lib/server/trackers/aither.ts
