import { iso6392 } from 'iso-639-2';
import { log } from './util/log';

const audioTranslationTable: { from: string[], to: string, plus?: string }[] = [
    { from: ['aac', 'aac lc'], to: 'AAC' },
    { from: ['alac'], to: 'ALAC' },
    { from: ['dd', 'ac-3'], to: 'DD' },
    { from: ['ddp', 'dd+', 'e-ac-3', 'e-ac-3 joc', 'ddpa', 'ddp atmos', 'dd+ atmos'], to: 'DDP', plus: 'DD+' },
    { from: ['dts'], to: 'DTS' },
    { from: ['dts-hd ma', 'dts xll'], to: 'DTS-HD MA' },
    { from: ['dts-x', 'dts xll x'], to: 'DTS:X' },
    { from: ['flac'], to: 'FLAC' },
    { from: ['opus'], to: 'Opus' },
    { from: ['pcm'], to: 'LPCM' },
    { from: ['truehd', 'mlp fba', 'mlp fba 16-ch', 'mlp fba ac-3 16-ch', 'truehd atmos'], to: 'TrueHD' },
    { from: ['vorbis'], to: 'Vorbis' },
];

const atmosFormats = [
    'ddpa',
    'ddp atmos',
    'dd+ atmos',
    'e-ac-3 joc',
    'mlp fba 16-ch',
    'mlp fba ac-3 16-ch',
    'truehd atmos',
];

const editionTranslationTable = [
    { from: ['alternative cut', 'alternate cut'], to: 'Alternative Cut' },
    { from: ['collectors edition', "collector's edition"], to: "Collector's Edition" },
    { from: ['directors cut', "director's cut", 'directors edition', "director's edition"], to: "Director's Cut" },
    { from: ['extended cut', 'extended edition', 'extended'], to: 'Extended' },
    { from: ['limited edition', 'limited'], to: 'Limited Edition' },
    { from: ['special edition'], to: 'Special Edition' },
    { from: ['theatrical cut', 'theatrical'], to: 'Theatrical Cut' },
] as const satisfies { from: string[], to: string }[];

type Edition = typeof editionTranslationTable[number]['to'] | null;

const sourceTranslationTable: { from: string[], to: string }[] = [
    { from: ['web', 'webdl', 'web-dl'], to: 'WEB-DL' },
    { from: ['webrip', 'web-rip', 'webcap', 'web-cap'], to: 'WEBRip' },
]

const videoTranslationTable: { from: string[], to: string, toLikeH264?: string, toEncoder?: string }[] = [
    { from: ['av1'], to: 'AV1' },
    { from: ['mpeg video', 'mpeg-2'], to: 'MPEG-2' },
    { from: ['x264'], to: 'AVC', toLikeH264: 'H.264', toEncoder: 'x264' },
    { from: ['avc', 'h264', 'h 264', 'h.264'], to: 'AVC', toLikeH264: 'H.264' },
    { from: ['x265'], to: 'HEVC', toLikeH264: 'H.265', toEncoder: 'x265' },
    { from: ['hevc', 'h265', 'h 265', 'h.265'], to: 'HEVC', toLikeH264: 'H.265' },
];

export interface ReleaseState {
    atmos: boolean;
    audio: { p: string, plus: string } | null;
    audioCodec: { p: string, plus: string } | null;
    category: 'tv' | 'movie' | null;
    censored: string | null;
    channels: string | null;
    dv: string | null;
    dvProfile: 5 | 7 | 8 | 10 | 20 | null;
    edition: Edition;
    episode: number | null;
    episodeTitle: string | null;
    extension: string | null;
    fileName: string;
    group: string | null;
    hdr: { short: string, plus: string, long: string } | null;
    language: string | null;
    multiAudio: string | null;
    originalTitle: string | null;
    remux: boolean;
    repack: string | null;
    resolution: string | null;
    scanType: 'Interlaced' | 'Progressive' | null;
    season: number | null;
    seasonEpisode: string | null;
    source: string | null;
    streamingService: string | null;
    title: string;
    videoCodec: { likeAvc: string, likeH264: string, encoder: string | null } | null;
    year: number | null;
}

export default class Release {

    private _atmos: boolean = false;
    private _audio: { p: string; plus: string } | null = null;
    private _audioCodec: { p: string; plus: string } | null = null;
    private _category: 'tv' | 'movie' | null = null;
    private _censored: 'CENSORED' | 'UNCENSORED' | 'UNCUT' | 'UNRATED' | null = null;
    private _channels: string | null = null;
    private _dv: true | 5 | 7 | 8 | 10 | 20 | null = null;
    private _edition: Edition = null;
    private _episode: number | null = null;
    private _extension: string | null = null;
    private _fileName: string;
    private _group: string | null = null;
    private _hdr: { short: string, plus: string, long: string } | null = null;
    private _language: string | null = null;
    private _multiAudio: string | null = null;
    private _originalTitle: string | null = null;
    private _remux: boolean = false;
    private _repack: string | null = null;
    private _resolution: string | null = null;
    private _scanType: 'Interlaced' | 'Progressive' | null = null;
    private _season: number | null = null;
    private _seasonEpisode: string | null = null;
    private _seasonOrEpisodeTitle: string | null = null;
    private _source: string | null = null;
    private _streamingService: string | null = null;
    private _title = '';
    private _videoCodec: { likeAvc: string, likeH264: string, encoder: string | null } | null = null;
    private _year: number | null = null;

    constructor(input: string) {

        this._fileName = input;

        input = input.replace(/\./g, ' ');
        input = input.replace(/ {2,}/g, ' ');
        input = input.trim();

        const tvRegexp = /^(.+?) (S[0-9]+(?:E[0-9]+(?:[E-][0-9]+)*)?) (.+?)(?:-(\w+))?(?: (mkv|mp4))?$/i;
        const movieRegexp = /^(.+?) \(?([0-9]{4})\)? (.+?)(?:-(\w+))?(?: (mkv|mp4))?$/i;

        const tvMatches = input.match(tvRegexp);
        const movieMatches = input.match(movieRegexp);

        if (tvMatches) {

            this._category = 'tv';

            const [, seriesName, seasonEpisode, videoDetails, group, extension] = tvMatches;

            this.setTitle(seriesName!);
            this.setSeasonEpisode(seasonEpisode!);
            this.setGroup(group!);
            this.setExtension(extension!);
            this.parseVideoDetails(videoDetails!);

        } else if (movieMatches) {

            this._category = 'movie';

            const [, movieName, year, videoDetails, group, extension] = movieMatches;

            this.setTitle(movieName!);
            this.setYear(parseInt(year!));
            this.setGroup(group!);
            this.setExtension(extension!);
            this.parseVideoDetails(videoDetails!);

        }

    }

    private buildAudioRegexp() {
        
        let froms: string[] = [];

        for (const translation of audioTranslationTable) {
            froms.push(...translation.from);
        }

        froms = froms.map(value => RegExp.escape(value));

        return new RegExp(`(?:^| )(${froms.join('|')})(?: ?((?:[1-9]|[1-2][0-9]).[0-2](?:.[0-9])?))?(?: ?(atmos))?$`, 'i');

    }

    private buildEditionRegexp() {

        const editions: string[] = [];

        for (const translation of editionTranslationTable) {
            editions.push(...translation.from);
        }

        const escaped = editions.map(edition => RegExp.escape(edition));

        return new RegExp(`(?:^| )(${escaped.join('|')})$`, 'i')
    
    }

    private buildLanguageRegexp() {

        const languages: string[] = [];

        for (const language of iso6392) {
            const names = language.name.split('; ');
            for (const name of names) {
                if (!/^[a-z]+$/i.test(name)) continue;
                languages.push(name.toLowerCase());
                languages.push(name.toUpperCase());
                if (name.toLowerCase().includes('i')) languages.push(name.toUpperCase().replace(/I/g, 'i'));
            }
        }

        return new RegExp(`(?:^| )(${languages.join('|')})$`, 'i');

    }

    private buildVideoCodecRegexp() {

        let froms: string[] = [];

        for (const translation of videoTranslationTable) {
            froms.push(...translation.from);
        }

        froms = froms.map(value => RegExp.escape(value));

        return new RegExp(`(?:^| )(${froms.join('|')})$`, 'i');

    }

    format(format: string) {

        format = format.replace(/([- .]+)?{(.+?)}/ig, (fullMatch, whitespace, tag): string => {

            let output: string | null = null;

            const [tagName, ..._arguments] = tag.split(' ');

            if (_arguments.includes('if_special') && !(this.season === 0 || this.episode === 0)) {
                return '';
            }

            if (_arguments.includes('if_not_english') && this.language === null) {
                return '';
            }

            if (_arguments.includes('if_not_dual_audio') && this.multiAudio) {
                return '';
            }

            switch (tagName) {

                case 'title':
                    output = this.title;
                    if (
                        _arguments.includes('aka') &&
                        this.originalTitle &&
                        this.originalTitle !== this.title
                    ) {
                        output += ` AKA ${this.originalTitle}`;
                    }
                    break;
                
                case 'year': output = this.year ? String(this.year) : null; break;
                case 'season_episode': output = this.seasonEpisode; break;
                case 'season_or_episode_title': output = this.seasonOrEpisodeTitle; break;
                case 'season_title': output = this.seasonTitle; break;
                case 'episode_title': output = this.episodeTitle; break;
                case 'edition': output = this.edition; break;
                case 'attributes': output = this.censored; break;
                case 'language': output = this.language; break;
                case 'repack': output = this.repack; break;
                case 'remux': output = this.remux ? 'REMUX' : null; break;
                case 'resolution': output = this.resolution; break;
                case 'source': output = this.source; break;

                case 'audio':
                    if (this.audio) {
                        output = _arguments.includes('plus') ? this.audio?.plus : this.audio?.p;
                    }
                    break;

                case 'video':

                    if (this.videoCodec) {
                        if (_arguments.includes('encoder')) output = this.videoCodec.encoder || this.videoCodec.likeAvc;
                        else if (_arguments.includes('like_h264')) output = this.videoCodec.likeH264;
                        else output = this.videoCodec.likeAvc;
                    }

                    if (this.hdr) {
                        output = `${this.hdr.plus} ${output}`;
                    }

                    if (this.dv) {
                        output = `DV ${output}`;
                    }

                    break;

                case 'group': output = this.group; break;

            }

            return output ? `${whitespace || ''}${output}` : '';

        });

        return format;

    }

    get atmos() { return this._atmos; }
    get attributes() { return this._censored; }
    get audio() { return this._audio; }
    get audioCodec() { return this._audioCodec; }
    get category() { return this._category; }
    get censored() { return this._censored; }
    get channels() { return this._channels; }
    get dv() { return this._dv ? 'DV' : null; }
    get dvProfile() { return typeof this._dv === 'number' ? this._dv : null; }
    get edition() { return this._edition; }
    get episode() { return this._episode; }
    get episodeTitle() {
        if (!this._seasonOrEpisodeTitle) return null;
        if (null === this._episode) return null;
        return this._seasonOrEpisodeTitle;
    }
    get extension() { return this._extension; }
    get fileName() { return this._fileName; }
    get fullDisc() { return false; }
    get group() { return this._group; }
    get hdr() { return this._hdr };
    get isSeasonPack() {
        if (this._category === 'movie') return false;
        if (this._episode !== null) return false;
        if (this._season === null) return false;
        if (this._season === 0) return false;
        return true;
    }
    get language() { return this._language; }
    get multiAudio() { return this._multiAudio; }
    get originalTitle() { return this._originalTitle; }
    get remux() { return this._remux; }
    get repack() { return this._repack; }
    get resolution() { return this._resolution; }
    get scanType() { return this._scanType; }
    get season() { return this._season; }
    get seasonEpisode() { return this._seasonEpisode; }
    get seasonOrEpisodeTitle() { return this._seasonOrEpisodeTitle; }
    get seasonTitle() {
        if (!this._seasonOrEpisodeTitle) return null;
        if (this._episode) return null;
        return this._seasonOrEpisodeTitle;
    }
    get source() { return this._source; }
    get streamingService() { return this._streamingService; }
    get title() { return this._title; }
    get videoCodec() { return this._videoCodec; };
    get year() { return this._year; }

    /**
     * Parses video details from a release group string, starting from the end of the string and moving forward until
     * no explicit matches are found, then assumes whatever is left over is an episode name.
     * @param details A string like "1080p WEB-DL DDP5 1 H 264"
     */

    private parseVideoDetails(details: string) {

        let position = details.length;

        const editionRegexp = this.buildEditionRegexp();
        const languageRegexp = this.buildLanguageRegexp();
        const censoredRegexp = /(?:^| )(censored|uncensored|uncut|unrated)$/i;
        const repackRegexp = /(?:^| )(repack[1-9]?|proper|dirfix)$/i;
        const resolutionRegexp = /(?:^| )(480[pi]|576[pi]|720p|1080[pi]|2160p)$/i;
        const webSourceRegexp = /(?:^| )(?:([a-z][a-z0-9]{1,3}|amazon|netflix|criterion) )?(web-dl|web-rip|web-cap|webdl|webrip|webcap|web)$/i;
        const sourceRegexp = /(?:^| )((?:[a-z]{3} )?(?:uhd )?blu-?ray|hdtv|sdtv|(?:ntsc |pal )?dvd(?:rip)?|dvd5|dvd9)$/i;
        const remuxRegexp = /(?:^| )(remux)$/i;
        const audioRegexp = this.buildAudioRegexp(); 
        const multiAudioRegexp = /(?:^| )(dual|dual-audio|multi|multilang|multi-audio|multilingual)$/i;
        const videoCodecRegexp = this.buildVideoCodecRegexp();
        const videoHdrRegexp = /(?:^| )(pq10|hlg|hdr(?:10(?:[+p]|plus)?)?)$/i;
        const videoDvRegexp = /(?:^| )(dv|dovi)$/i;

        let foundEdition = false;
        let foundLanguage = false;
        let foundCensored = false;
        let foundRepack = false;
        let foundResolution = false;
        let foundSource = false;
        let foundRemux = false;
        let foundAudio = false;
        let foundMultiAudio = false;
        let foundVideoCodec = false;
        let foundVideoHdr = false;
        let foundVideoDv = false;

        while (position > 0) {

            const nextDetails = details.substring(0, position);

            let matches: RegExpMatchArray | null = null;

            // Video
            if ((matches = nextDetails.match(videoCodecRegexp)) && !foundVideoCodec) {

                foundVideoCodec = true;
                const [, codec] = matches;
                this.setVideoCodec(codec!);

            // HDR
            } else if ((matches = nextDetails.match(videoHdrRegexp))) {
                
                foundVideoHdr = true;
                const [, hdr] = matches;
                this.setHdr(hdr!);

            // DV
            } else if ((matches = nextDetails.match(videoDvRegexp)) && !foundVideoDv) {

                foundVideoDv = true;
                const [, dv] = matches;
                this.setDv(true);

            // Dual/multi audio
            } else if ((matches = nextDetails.match(multiAudioRegexp)) && !foundMultiAudio) {

                foundMultiAudio = true;
                const [, multiAudio] = matches;
                this.setMultiAudio(multiAudio!);

            // Audio
            } else if ((matches = nextDetails.match(audioRegexp)) && !foundAudio) {

                foundAudio = true;
                const [, codec, channels, atmos] = matches;
                this.setAudioCodec(codec!);
                if (channels) this.setChannels(channels);
                if (atmos) this.setAtmos(true);

            // Web source
            } else if ((matches = nextDetails.match(webSourceRegexp)) && !foundSource) {

                foundSource = true;
                const [, streamingService, source] = matches;
                if (streamingService) {
                    this.setSource(`${streamingService} ${source}`);
                } else {
                    this.setSource(source!);
                }

            // Other sources
            } else if ((matches = nextDetails.match(sourceRegexp)) && !foundSource) {

                foundSource = true;
                const [, source] = matches;
                this.setSource(source!);

            // Remux
            } else if ((matches = nextDetails.match(remuxRegexp)) && !foundRemux) {

                foundRemux = true;
                this.setRemux(true);

            // Resolution
            } else if ((matches = nextDetails.match(resolutionRegexp)) && !foundResolution) {

                foundResolution = true;
                const [, resolution] = matches;
                this.setResolution(resolution!);

            // Repack
            } else if ((matches = nextDetails.match(repackRegexp)) && !foundRepack) {

                foundRepack = true;
                const [, repack] = matches;
                this.setRepack(repack!);

            // Censored/uncensored/uncut/unrated
            } else if ((matches = nextDetails.match(censoredRegexp)) && !foundCensored) {

                foundCensored = true;
                const [, censored] = matches;
                this.setCensored(censored!);

            // Language
            } else if ((matches = nextDetails.match(languageRegexp)) && !foundLanguage) {

                foundLanguage = true;
                const [, language] = matches;
                this.setLanguage(language!);

            // Edition
            } else if ((matches = nextDetails.match(editionRegexp)) && !foundEdition) {

                foundEdition = true;
                const [, edition] = matches;
                this.setEdition(edition!);

            // Unmatched
            } else {

                this.setSeasonOrEpisodeTitle(nextDetails);
                break;

            }

            if (matches) {
                position -= matches[0].length;
            }

        }

    }

    setAtmos(atmos: boolean) {
        this._atmos = atmos;
        this.setAudio();
    }

    private setAudio() {

        const parts: string[] = [];
        if (this.multiAudio) parts.push(this.multiAudio);
        if (this.audioCodec?.p) parts.push(this.audioCodec.p);
        if (this.channels) parts.push(this.channels);
        if (this.atmos) parts.push('Atmos');
        const p = parts.join(' ');

        const plusParts: string[] = [];
        if (this.multiAudio) plusParts.push(this.multiAudio);
        if (this.audioCodec?.plus) plusParts.push(this.audioCodec.plus);
        if (this.channels) plusParts.push(this.channels);
        if (this.atmos) plusParts.push('Atmos');
        const plus = plusParts.join(' ');

        this._audio = { p, plus };

    }

    setAudioCodec(codec: string) {

        codec = codec.toLowerCase().trim();

        const match = audioTranslationTable.find(translation => {
            return translation.from.includes(codec);
        });

        if (!match) {
            console.log(`Couldn't find matching audio codec for ${codec}`);
            this._audioCodec = {
                p: codec.toUpperCase(),
                plus: codec.toUpperCase(),
            };
            return;
        }

        this._audioCodec = {
            p: match.to,
            plus: match.plus || match.to,
        }

        if (atmosFormats.includes(codec)) {
            this.setAtmos(true);
        }

        this.setAudio();

    }

    setCensored(censored: string) {
        switch (censored.trim().toLowerCase()) {
            case 'censored': this._censored = 'CENSORED'; break;
            case 'uncensored': this._censored = 'UNCENSORED'; break;
            case 'unrated': this._censored = 'UNRATED'; break;
            case 'uncut': this._censored = 'UNCUT'; break;
            default: this._censored = null;
        }
    }

    setChannels(channels: string) {
        channels = channels.toLowerCase().trim().replace(/ /g, '.');
        this._channels = channels;
        this.setAudio();
    }

    setChannelLayout(layout: string): void {
        
        let numChannels = 0;
        let numLfes = 0;
        let numHigh = 0;
        let numLow = 0;

        const channels: string[] = layout.trim().split(' ');
        for (const channel of channels) {
            if (['C', 'Rc', 'R', 'Rw', 'Rss', 'Rs', 'Rsd', 'Rb', 'Cb', 'Lb', 'Lsd', 'Ls', 'Lss', 'Lw', 'L', 'Lc'].includes(channel)) {
                numChannels++;
            } else if (['LFE', 'LFE2'].includes(channel)) {
                numLfes++;
            } else if (['Tfc', 'Tfr', 'Tsr', 'Rvs', 'Tbr', 'Tbc', 'Tbl', 'Lvs', 'Tsl', 'Tfl', 'Tc'].includes(channel)) {
                numHigh++;
            } else if (['Bfc', 'Bfr', 'Bsr', 'Bbr', 'Bbc', 'Bbl', 'Bsl', 'Bfl'].includes(channel)) {
                numLow++;
            } else if (['Objects'].includes(channel)) {
                // Positional audio from DTS:X
            } else {
                log(`Found unknown audio channel type ${channel}, not updating channels from MediaInfo`, 'khaki');
                return;
            }
        }

        let output = `${numChannels}.${numLfes}`;

        if (numHigh > 0 || numLow > 0) {
            output += `.${numHigh}`;
        }

        if (numLow > 0) {
            output += `.${numLow}`;
        }

        this._channels = output;

        this.setAudio();

    }

    setDimensions(width: number, height: number, scanType?: string): void {

        if (scanType === 'Interlaced' || scanType === 'Progressive') {
            this._scanType = scanType;
        }

        const resolutions: [number, number][] = [
            [8192, 4320],
            [3840, 2160],
            [1920, 1080],
            [1280, 720],
            [1024, 576],
            [720, 480],
        ];

        for (const resolution of resolutions) {

            const [checkWidth, checkHeight] = resolution;

            if (checkWidth * 0.9 > width && checkHeight * 0.9 > height) {
                continue;
            }

            this.setResolution(`${checkHeight}${this._scanType === 'Interlaced' ? 'i' : 'p'}`);

            return;

        }

    }

    setDv(dv: typeof this._dv | 'DV') {
        this._dv = dv === 'DV' ? true : dv;
    }

    setEdition(edition: string) {

        log(`Matched edition ${edition}`, 'khaki');

        edition = edition.toLowerCase().trim();

        for (const translation of editionTranslationTable) {
            for (const from of translation.from) {
                if (from === edition) {
                    this._edition = translation.to;
                    return;
                }
            }
        }
        this._edition = null;
    }

    setExtension(extension: string) {
        this._extension = extension || null;
    }

    setGroup(group: string) {
        this._group = group || null;
    }

    setHdr(hdr: string | null) {

        hdr = hdr ? hdr.toLowerCase().trim() : null;

        switch (hdr) {

            case 'hdr': case 'hdr10':
                this._hdr = { short: 'HDR', plus: 'HDR', long: 'HDR10' };
                break;
            
            case 'hdr10+': case 'hdr10p': case 'hdr10plus':
                this._hdr = { short: 'HDR', plus: 'HDR10+', long: 'HDR10Plus' };
                break;
            
            case 'hdr vivid':
                this._hdr = { short: 'HDR', plus: 'HDR Vivid', long: 'HDR Vivid' };
                break;
            
            case 'hlg':
                this._hdr = { short: 'HLG', plus: 'HLG', long: 'HLG' };
                break;
            
            case 'pq10':
                this._hdr = { short: 'PQ', plus: 'PQ10', long: 'PQ10' };
                break;
            
            default:
                this._hdr = null;

        }

    }

    setHdrFormat(
        format: string | undefined,
        profile: string | undefined,
        transferCharacteristics: string | undefined,
        maxCll: string | undefined
    ) {

        this.setDv(null);
        this.setHdr(null);

        if (profile) {

            const match = profile.match(/\bdv(?:he|me)\.(\d+)/i);
            if (match) {
                const dvProfile = parseInt(match[1]!, 10);
                switch (dvProfile) {
                    case 5: case 7: case 8: case 10: case 20:
                        this.setDv(dvProfile);
                        break;
                    default:
                        log(`Unrecognized DV profile ${dvProfile}`, 'khaki');
                }
            }

        }

        if (format) {

            const segments = format.split(' / ');
            if (segments.some(segment => segment === 'SMPTE ST 2094 App 4')) {
                this.setHdr('HDR10+');
            } else if (segments.some(segment => segment === 'HDR Vivid')) {
                this.setHdr('HDR Vivid');
            } else if (segments.some(segment => segment === 'SMPTE ST 2086')) {
                this.setHdr('HDR10');
            }

        } else {
            if (transferCharacteristics === 'HLG') {
                this.setHdr('HLG');
            } else if (transferCharacteristics === 'PQ') {
                this.setHdr(maxCll ? 'HDR10' : 'PQ10');
            }
        }

    }

    setLanguage(input: string) {

        if (!input || input.toLowerCase() === 'und') {
            this._language = null;
            return;
        }

        const countryCodeMatches = input.match(/([a-z]{2,3})-[a-z0-9]{2,3}/i);
        if (countryCodeMatches && countryCodeMatches[1]) input = countryCodeMatches[1];

        this._language = '';

        for (const language of iso6392) {

            const names = language.name.split('; ');

            for (const name of names) {
                if (name.toLowerCase() === input.toLowerCase()) {
                    this._language = name;
                    break;
                } else if (language.iso6392B.toLowerCase() === input.toLowerCase()) {
                    this._language = name;
                    break;
                } else if (language.iso6391 && language.iso6391.toLowerCase() === input.toLowerCase()) {
                    this._language = name;
                    break;
                }
            }

        }

        if (!this._language) this._language = input;

        if (['en', 'eng', 'english'].includes(this._language.toLowerCase())) {
            this._language = null;
            return;
        }

        this._language = this._language.toUpperCase();

    }

    setMultiAudio(multiAudio: string) {

        multiAudio = multiAudio.toLowerCase().trim();

        if (multiAudio.startsWith('dual')) {
            this._multiAudio = 'Dual-Audio';
        } else if (multiAudio.startsWith('multi')) {
            this._multiAudio = 'Multi';
        } else {
            this._multiAudio = null;
        }

        this.setAudio();

    }

    setOriginalTitle(title: string) {
        title = title.trim();
        this._originalTitle = title || null;
    }

    setRemux(remux: boolean) {
        this._remux = remux;
    }

    setRepack(repack: string) {
        repack = repack.trim();
        this._repack = repack || null;    
    }

    setResolution(resolution: string) {

        this._resolution = null;

        const match = resolution.match(/^[0-9]+([ip])/i);
        if (match) {
            this._resolution = match[0];
            if (match[1]!.toLowerCase() === 'i') {
                this._scanType = 'Interlaced';
            } else {
                this._scanType = 'Progressive';
            }
        }

    }

    setSeasonEpisode(seasonEpisode: string) {

        seasonEpisode = seasonEpisode.toUpperCase().trim();

        const seasonMatch = seasonEpisode.match(/S(\d+)/);
        const episodeMatch = seasonEpisode.match(/E(\d+)/);

        if (!seasonEpisode || (!seasonMatch && !episodeMatch)) {
            this._seasonEpisode = null;
            this._season = null;
            this._episode = null;
            return;
        }

        if (seasonMatch) {
            this._season = parseInt(seasonMatch[1]!, 10);
            if (!episodeMatch) this._episode = null;
        }

        if (episodeMatch) {
            this._episode = parseInt(episodeMatch[1]!, 10);
            if (!seasonMatch) this._season = null;
        }

        this._seasonEpisode = seasonEpisode;

    }

    setSeasonOrEpisodeTitle(title: string) {
        title = title.trim();
        this._seasonOrEpisodeTitle = title;
    }

    setSource(source: string) {

        source = source.trim();

        const webMatch = source.match(/^(?:([a-z0-9]+)\s+)?(?:(web[a-z-]*))$/i);

        if (webMatch) {

            let [, streamingService, source] = webMatch;

            if (streamingService && streamingService.toLowerCase() === 'amazon') streamingService = 'AMZN';
            if (streamingService && streamingService.toLowerCase() === 'netflix') streamingService = 'NF';

            const translation = sourceTranslationTable.find(translation => {
                return translation.from.includes(source!.toLowerCase());
            });

            if (!translation) {
                this._source = streamingService ? `${streamingService} WEBRip` : 'WEBRip';
                return;
            }

            if (streamingService) {
                this._streamingService = streamingService.toUpperCase();
                this._source = `${streamingService} ${translation.to}`;
            } else {
                this._source = translation.to;
            }

            return;

        }

        const translation = sourceTranslationTable.find(translation => {
            return translation.from.includes(source.toLowerCase());
        });

        this._source = translation?.to || source;

    }

    setTitle(title: string) {
        this._title = title;
    }

    setVideoCodec(codec: string) {

        if (!codec) {
            this._videoCodec = null;
            return;
        }

        const match = videoTranslationTable.find(translation => {
            return translation.from.includes(codec.toLowerCase());
        });

        if (!match) {
            console.log(`Couldn't find matching video codec for ${codec}`);
            this._videoCodec = {
                likeAvc: codec.toUpperCase(),
                likeH264: codec.toUpperCase(),
                encoder: null,
            }
            return;
        }

        this._videoCodec = {
            likeAvc: match.to,
            likeH264: match.toLikeH264 || match.to,
            encoder: match.toEncoder || null,
        };

    }

    setYear(year: number) {
        this._year = year === 0 ? null : year;
    }

    toJSON(): ReleaseState {
        return {
            atmos: this.atmos,
            audio: this.audio,
            audioCodec: this.audioCodec,
            category: this.category,
            censored: this.censored,
            channels: this.channels,
            dv: this.dv,
            dvProfile: this.dvProfile,
            edition: this.edition,
            episode: this.episode,
            episodeTitle: this.episodeTitle,
            extension: this.extension,
            fileName: this.fileName,
            group: this.group,
            hdr: this.hdr,
            language: this.language,
            multiAudio: this.multiAudio,
            originalTitle: this.originalTitle,
            remux: this.remux,
            repack: this.repack,
            resolution: this.resolution,
            scanType: this.scanType,
            season: this.season,
            seasonEpisode: this.seasonEpisode,
            source: this.source,
            streamingService: this.streamingService,
            title: this.title,
            videoCodec: this.videoCodec,
            year: this.year,
        };
    }

}