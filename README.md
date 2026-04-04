# ak-automated-uploader

AK Automated Uploader is a web-based torrent uploader tool for private trackers.

Well, two private trackers. More coming. Probably.

Upload files by picking them via the web UI, or go fully automated with the API.

![Screenshot of the AK Automated Uploader user interface](https://files.catbox.moe/i32l9r.png)

Supported trackers:

| Tracker | Features |
| ------- | -------- |
| Aither  | Duplicate search, banned groups, season pack trumping, repack trumping |
| LST     | Duplicate search, banned groups, season pack trumping, repack trumping |

Supported image hosts:
- Catbox
- Freeimage.host
- ImgBB
- imgbox
- PiXhost

Supported torrent clients:
- qBittorrent

## Prerequisites

Any new-ish version of the following should do. Put them in your PATH.

- [Bun](https://bun.com/)
- [ffmpeg/ffprobe](https://www.ffmpeg.org/)
- [mkbrr](https://mkbrr.com/)

You'll also need a TMDB API key.

## Getting started

To run from source, download and run the following:

```
bun install
bun --bun run build
```

```
ORIGIN=http://localhost:3000 bun build/index.js
```

Or on PowerShell:

```
$env:ORIGIN = "http://localhost:3000"
bun build/index.js
```

Change the port with a `PORT` environment variable:

```
PORT=12345 ORIGIN=http://localhost:12345 bun build.index.js
```

Configure your image hosts, torrent client, and trackers on the settings page.

## Known issues

- Questionable filenames may or may not work.