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
- ptpimg
- Zipline (untested)

Supported torrent clients:
- qBittorrent

## Prerequisites

Any new-ish version of the following should do. Put them in your PATH.

- [Bun](https://bun.com/)
- [ffmpeg/ffprobe](https://www.ffmpeg.org/)
- [mkbrr](https://mkbrr.com/)

You'll also need a TMDB API key.

## Getting started

Download the latest release and run the following:

```
bun install
ORIGIN=http://localhost:51901 PORT=51901 bun build/index.js
```

Or on PowerShell:

```
$env:ORIGIN = "http://localhost:51901"
$env:PORT = "51901"
bun install
bun build/index.js
```

Configure your image hosts, torrent client, and trackers on the settings page.

## Docker image

Or use the Docker image at `ghcr.io/aqtku/ak-automated-uploader:latest`.

Here's a docker-compose:

```
services:
  uploader:
    image: ghcr.io/aqtku/ak-automated-uploader:latest
    container_name: ak-automated-uploader
    ports:
      - "51901:51901"
    volumes:
      - ./config:/config
      - /path/to/your/media:/mnt:ro
    environment:
      - PORT=51901
      - ORIGIN=http://localhost:51901
      - APPDATA=/config
      - HOME=/mnt
    restart: unless-stopped
```

## Known issues

- Questionable filenames may or may not work.