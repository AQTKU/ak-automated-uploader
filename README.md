# ak-automated-uploader

AK Automated Uploader is a web-based torrent uploader tool for private trackers.

Well, two private trackers. More coming. Probably.

Features:
- Creates torrents with mkbrr
- Takes and uploads screenshots
- Parses MediaInfo
- Corrects filenames

Supported image hosts:
- Catbox
- Freeimage.host
- ImgBB
- imgbox
- PiXhost

Supported trackers:
- Aither
- LST

Supported torrent clients:
- qBittorrent

## Prerequesites

Any new-ish version of the following should do. Put them in your PATH.

- Bun
- ffmpeg/ffprobe
- mkbrr

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

---

More details to come.