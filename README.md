<h1 align="center"><img alt="AK Automated Uploader" src="static/logo.svg" width="250"></h1>

AK Automated Uploader is a web-based torrent uploader tool for private trackers.

Well, a few private trackers. More coming. Probably.

Upload files by picking them via the web UI, or go fully automated with the API.

![Screenshot of the AK Automated Uploader user interface](https://files.catbox.moe/i32l9r.png)

## Supported trackers

| Tracker         | Features |
| --------------- | -------- |
| Aither          | Duplicate search, banned groups, season pack trumping, repack trumping |
| BeyondHD\*      | Duplicate search, banned groups |
| LST             | Duplicate search, banned groups, season pack trumping, repack trumping |
| MidnightScene\* | Untested |
| Seedpool\*      | Untested |

\* These ones probably work but could use a little testing.

## Getting started

### Prerequisites

Any new-ish version of the following should do. Put them in your PATH.

- [Bun](https://bun.com/)
- [ffmpeg/ffprobe](https://www.ffmpeg.org/)
- [mkbrr](https://mkbrr.com/)

### Linux and Mac

Download the latest release and run the following:

```sh
bun install
ORIGIN=http://localhost:51901 PORT=51901 bun build/index.js
```

### Windows

Download the latest release and run the following in PowerShell:

```powershell
$env:ORIGIN = "http://localhost:51901"
$env:PORT = "51901"
bun install
bun build/index.js
```

### Docker

Use the Docker image at `ghcr.io/aqtku/ak-automated-uploader:latest`. All the
prerequisites are included.

```yaml
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
      - ORIGIN=http://localhost:51901 # Or whatever the location of your Docker setup is
      - APPDATA=/config
      - HOME=/mnt # Default folder within the container for browsing files
    restart: unless-stopped
```

### After install

Open http://localhost:51901 (or the location you set in your docker-compose)
where you'll be given your login token. Configure your image hosts, torrent
client, and trackers on the settings page. You'll also need a [TMDB API key](https://www.themoviedb.org/settings/api/request).

## Supported services

Image hosts:
- Catbox
- Freeimage.host
- ImgBB
- imgbox
- PiXhost
- ptpimg
- Zipline

Torrent clients:
- qBittorrent
- rTorrent (experimental)
- Just saving the .torrent file to a folder

Metadata:
- TMDB
- Jikan
- srrdb

This product uses the TMDB API but is not endorsed or certified by TMDB.

<img alt="TMDB logo" src="static/tmdb.svg" width="100">

## Known issues

- The filename parser is a whitelist, so unexpected tokens can cause stuff like
  video codec to appear as an episode name. You can tidy it up with the release
  editor by clicking the filename header.
- No support for full discs yet.

## Contributing

Feel free to open a GitHub issue to request a new tracker. Pull requests are
also appreciated - tracker code is deliberately straightforward, easy to write
by hand or by your favourite AI agent.
