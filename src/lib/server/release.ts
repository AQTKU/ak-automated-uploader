import { iso6392 } from 'iso-639-2';
import { log } from './util/log';
import type { MediaInfo } from './mediainfo';
import {
    audioCodecs, categories, censoredStates, channelPositions, dvProfiles, editions, hdrFormats,
    multiAudioFormats, repackAliases, repackNames, resolutionNames, resolutions, signLanguages,
    sources, streamingServiceAliases, streamingServices, videoCodecs,
    type AudioCodec, type Category, type Censored, type ChannelPosition, type DvProfile,
    type Edition, type Hdr, type MultiAudio, type Repack, type Resolution, type ScanType,
    type SignLanguage, type Source, type StreamingService, type VideoCodec,
} from './release-tables';

export interface ReleaseState {
    atmos: boolean;
    attributes: string;
    audio: { p: string, plus: string } | null;
    audioCodec: AudioCodec | null;
    audioDescription: boolean;
    category: Category | null;
    censored: Censored | null;
    channels: string | null;
    dv: boolean;
    dvProfile: DvProfile | null;
    edition: Edition | null;
    episode: number | null;
    episodeTitle: string | null;
    extension: string | null;
    fileName: string;
    group: string | null;
    hdr: Hdr | null;
    hybrid: boolean;
    isSeasonPack: boolean;
    isSpecial: boolean;
    language: string | null;
    multiAudio: MultiAudio | null;
    originalTitle: string | null;
    remux: boolean;
    repack: Repack | null;
    resolution: Resolution | null;
    scanType: ScanType | null;
    sdr: boolean;
    season: number | null;
    seasonEpisode: string | null;
    seasonOrEpisodeTitle: string | null;
    seasonTitle: string | null;
    signLanguage: SignLanguage | null;
    source: Source | null;
    streamingService: StreamingService | null;
    title: string;
    videoCodec: VideoCodec | null;
    year: number | null;
}

/* Longest first, so "HD BluRay" wins over "BluRay" when both could start at the
   same position. */
function alternation(values: readonly string[]) {
    return [...new Set(values)]
        .sort((first, second) => second.length - first.length)
        .map(value => RegExp.escape(value))
        .join('|');
}

function fromValues(table: readonly { from: readonly string[] }[]) {
    return table.flatMap(row => [...row.from]);
}

function findTranslation<T extends { from: readonly string[] }>(table: readonly T[], value: string) {
    const lookup = value.toLowerCase().trim();
    return table.find(row => (row.from as readonly string[]).includes(lookup));
}

const streamingServiceNames: string[] = [...streamingServices];
for (const aliases of Object.values(streamingServiceAliases)) {
    streamingServiceNames.push(...aliases);
}

const channelPositionsByName = new Map<string, ChannelPosition>();
for (const [position, names] of Object.entries(channelPositions) as [ChannelPosition, readonly string[]][]) {
    for (const name of names) channelPositionsByName.set(name, position);
}

/* Every pattern that translates to a table value is built from that table, so
   the setters can throw on anything they don't recognise without the filename
   parser ever being able to trigger it. */

const audioPattern = new RegExp(`(?:^| )(${alternation(fromValues(audioCodecs))})(?: ?((?:[1-9]|[1-2][0-9]).[0-2](?:.[0-9])?))?(?: ?(atmos))?$`, 'i');
const audioDescriptionPattern = /(?:^| )with audio description$/i;
const censoredPattern = new RegExp(`(?:^| )(${alternation(fromValues(censoredStates))})$`, 'i');
const dvPattern = /(?:^| )(?:dv|dovi)$/i;
const editionPattern = new RegExp(`(?:^| )(${alternation(fromValues(editions))})$`, 'i');
const hdrPattern = new RegExp(`(?:^| )(${alternation(fromValues(hdrFormats))})$`, 'i');
const hybridPattern = /(?:^| )hybrid$/i;
const multiAudioPattern = new RegExp(`(?:^| )(${alternation(fromValues(multiAudioFormats))})$`, 'i');
const remuxPattern = /(?:^| )remux$/i;
const repackPattern = new RegExp(`(?:^| )(${alternation([...repackNames, ...Object.keys(repackAliases)])})$`, 'i');
const resolutionPattern = new RegExp(`(?:^| )(${alternation(resolutionNames)})$`, 'i');
const signLanguagePattern = new RegExp(`(?:^| )with (${alternation(fromValues(signLanguages))})$`, 'i');
const sourcePattern = new RegExp(`(?:^| )(${alternation(fromValues(sources))})$`, 'i');
const streamingSourcePattern = new RegExp(
    `(?:^| )(?:(${alternation(streamingServiceNames)}) )?(${alternation(fromValues(sources.filter(row => 'streaming' in row)))})$`,
    'i'
);
const videoCodecPattern = new RegExp(`(?:^| )(${alternation(fromValues(videoCodecs))})$`, 'i');

/* Deliberately case sensitive, and deliberately not built with `alternation`'s
   deduplication in mind: plenty of language names are also ordinary nouns, so
   we match "spanish", "SPANISH" and "SPANiSH" but not "Spanish", which stops
   "Lucy Learns Spanish" being tagged as a Spanish-language release. */
const languagePattern = (() => {
    const names: string[] = [];
    for (const language of iso6392) {
        for (const name of language.name.split('; ')) {
            if (!/^[a-z]+$/i.test(name)) continue;
            names.push(name.toLowerCase());
            names.push(name.toUpperCase());
            if (name.toLowerCase().includes('i')) names.push(name.toUpperCase().replace(/I/g, 'i'));
        }
    }
    return new RegExp(`(?:^| )(${alternation(names)})$`);
})();

/* Applied in order against the tail of the remaining filename, each one eating
   what it matches. Order is precedence: video codec before HDR before DV, and
   the streaming-prefixed source before the bare one. Matchers run at most once
   unless `repeat` says otherwise, keyed on `name` — which is why both source
   matchers share a name. */

type DetailMatcher = {
    name: string;
    pattern: RegExp;
    repeat?: boolean;
    apply(release: Release, match: RegExpMatchArray): void;
};

const detailMatchers: DetailMatcher[] = [
    {
        name: 'videoCodec',
        pattern: videoCodecPattern,
        apply: (release, [, codec]) => release.setVideoCodec(codec!),
    },
    {
        /* Filenames stack HDR tags ("HDR.HDR10Plus") and we want to swallow all
           of them, but the most specific one is normally rightmost and we read
           right to left, so the first one we see is the one worth keeping. */
        name: 'hdr',
        pattern: hdrPattern,
        repeat: true,
        apply: (release, [, hdr]) => { if (!release.hdr) release.setHdr(hdr!); },
    },
    {
        name: 'dv',
        pattern: dvPattern,
        apply: release => release.setDv(true),
    },
    {
        name: 'multiAudio',
        pattern: multiAudioPattern,
        apply: (release, [, multiAudio]) => release.setMultiAudio(multiAudio!),
    },
    {
        name: 'audio',
        pattern: audioPattern,
        apply: (release, [, codec, channels, atmos]) => {
            release.setAudioCodec(codec!);
            if (channels) release.setChannels(channels);
            if (atmos) release.setAtmos(true);
        },
    },
    {
        name: 'source',
        pattern: streamingSourcePattern,
        apply: (release, [, streamingService, source]) => {
            release.setSource(source!);
            if (streamingService) release.setStreamingService(streamingService);
        },
    },
    {
        name: 'source',
        pattern: sourcePattern,
        apply: (release, [, source]) => release.setSource(source!),
    },
    {
        name: 'remux',
        pattern: remuxPattern,
        apply: release => release.setRemux(true),
    },
    {
        name: 'resolution',
        pattern: resolutionPattern,
        apply: (release, [, resolution]) => release.setResolution(resolution!),
    },
    {
        name: 'repack',
        pattern: repackPattern,
        apply: (release, [, repack]) => release.setRepack(repack!),
    },
    {
        name: 'hybrid',
        pattern: hybridPattern,
        apply: release => release.setHybrid(true),
    },
    {
        name: 'signLanguage',
        pattern: signLanguagePattern,
        apply: (release, [, signLanguage]) => release.setSignLanguage(signLanguage!),
    },
    {
        name: 'audioDescription',
        pattern: audioDescriptionPattern,
        apply: release => release.setAudioDescription(true),
    },
    {
        name: 'censored',
        pattern: censoredPattern,
        apply: (release, [, censored]) => release.setCensored(censored!),
    },
    {
        name: 'language',
        pattern: languagePattern,
        apply: (release, [, language]) => release.setLanguage(language!),
    },
    {
        name: 'edition',
        pattern: editionPattern,
        apply: (release, [, edition]) => release.setEdition(edition!),
    },
];

export default class Release implements Readonly<ReleaseState> {

    private _atmos: ReleaseState['atmos'] = false;
    private _audioCodec: ReleaseState['audioCodec'] = null;
    private _audioDescription: ReleaseState['audioDescription'] = false;
    private _category: ReleaseState['category'] = null;
    private _censored: ReleaseState['censored'] = null;
    private _channels: ReleaseState['channels'] = null;
    private _dv: ReleaseState['dv'] = false;
    private _dvProfile: ReleaseState['dvProfile'] = null;
    private _edition: ReleaseState['edition'] = null;
    private _episode: ReleaseState['episode'] = null;
    private _extension: ReleaseState['extension'] = null;
    private _fileName: ReleaseState['fileName'];
    private _group: ReleaseState['group'] = null;
    private _hdr: ReleaseState['hdr'] = null;
    private _hybrid: ReleaseState['hybrid'] = false;
    private _language: ReleaseState['language'] = null;
    private _multiAudio: ReleaseState['multiAudio'] = null;
    private _originalTitle: ReleaseState['originalTitle'] = null;
    private _remux: ReleaseState['remux'] = false;
    private _repack: ReleaseState['repack'] = null;
    private _resolution: ReleaseState['resolution'] = null;
    private _scanType: ReleaseState['scanType'] = null;
    private _season: ReleaseState['season'] = null;
    private _seasonEpisode: ReleaseState['seasonEpisode'] = null;
    private _seasonOrEpisodeTitle: ReleaseState['seasonOrEpisodeTitle'] = null;
    private _signLanguage: ReleaseState['signLanguage'] = null;
    private _source: ReleaseState['source'] = null;
    private _streamingService: ReleaseState['streamingService'] = null;
    private _title: ReleaseState['title'] = '';
    private _videoCodec: ReleaseState['videoCodec'] = null;
    private _year: ReleaseState['year'] = null;

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

    applyMediaInfo(mediaInfo: MediaInfo) {

        if (mediaInfo.defaultVideo) {

            const { Format, Width, Height, ScanType, HDR_Format, HDR_Format_Profile, transfer_characteristics,
                    MaxCLL, Encoded_Library_Name } = mediaInfo.defaultVideo;

            /* Encoded_Library_Name is free text, so fall back to the format
               when it isn't an encoder we recognise */
            if (Format) {
                try { this.setVideoCodec(Encoded_Library_Name || Format, true); }
                catch { this.setVideoCodec(Format, true); }
            }
            if (Width && Height) this.setDimensions(Width, Height, ScanType);
            if (HDR_Format) this.setHdrFormat(HDR_Format, HDR_Format_Profile, transfer_characteristics, MaxCLL);

        }

        if (mediaInfo.defaultAudio) {

            const { Format, Format_AdditionalFeatures, Channels, ChannelLayout, Language, Title } = mediaInfo.defaultAudio;

            if (Format) this.setAudioCodec(
                Format_AdditionalFeatures ? `${Format} ${Format_AdditionalFeatures}` : Format
            );

            if (ChannelLayout) {
                this.setChannelLayout(ChannelLayout);
            } else if (Channels) {
                switch (Channels) {
                    case 8: this.setChannels('7.1'); break;
                    case 6: this.setChannels('5.1'); break;
                    case 2: this.setChannels('2.0'); break;
                    // Trust whatever was in the filename for any other unusual formats
                }
            }

            if (Language) this.setLanguage(Language);

            const audioDescriptionTitles = [
                'descriptive',
                'audio description',
                'video description',
                'described video',
                'visual description',
            ];
            if (Title && audioDescriptionTitles.includes(Title.toLowerCase())) {
                this.setAudioDescription(true);
            }

        }

        const audioLanguages = new Set(mediaInfo.audio
            .filter(track => !(track.Title?.toLowerCase().includes('commentary')))
            .map(audio => audio.Language)
        );
        if (audioLanguages.size >= 3) {
            this.setMultiAudio('Multi');
        } else if (audioLanguages.size === 2) {
            this.setMultiAudio('Dual-Audio');
        }

    }

    format(template: string) {

        return template.replace(/([- .]+)?\{(.+?)\}/g, (
            fullMatch: string,
            whitespace: string | undefined,
            tag: string
        ): string => {

            let output: string | null = null;

            const [tagName, ...tagArguments] = tag.split(' ');

            if (tagArguments.includes('if_special') && !this.isSpecial) {
                return '';
            }

            if (tagArguments.includes('if_not_english') && this.language === null) {
                return '';
            }

            if (tagArguments.includes('if_not_dual_audio') && this.multiAudio) {
                return '';
            }

            switch (tagName) {

                case 'title':
                    output = this.title;
                    if (
                        tagArguments.includes('aka') &&
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
                case 'attributes': output = this.attributes; break;
                case 'language': output = this.language; break;
                case 'repack': output = this.repack; break;
                case 'remux': output = this.remux ? 'REMUX' : null; break;
                case 'resolution': output = this.resolution; break;

                case 'source':
                    if (this.source) {
                        output = this.streamingService
                            ? `${this.streamingService} ${this.source}`
                            : this.source;
                    }
                    break;

                case 'audio':
                    if (this.audio) {
                        output = tagArguments.includes('plus') ? this.audio.plus : this.audio.p;
                    }
                    break;

                case 'video':

                    if (this.videoCodec) {
                        if (tagArguments.includes('encoder')) output = this.videoCodec.encoder || this.videoCodec.likeH264;
                        else if (tagArguments.includes('like_h264')) output = this.videoCodec.likeH264;
                        else output = this.videoCodec.likeAvc;
                    }

                    if (this.hdr) {
                        output = `${this.hdr.plus} ${output}`;
                    }

                    if (this.dv) {
                        output = `DV ${output}`;
                    }

                    if (this.sdr && tagArguments.includes('sdr')) {
                        output = `SDR ${output}`;
                    }

                    break;

                case 'group':
                    output = this.group ?? (tagArguments.includes('or_NOGROUP') ? 'NOGROUP' : null);
                    break;

            }

            return output ? `${whitespace ?? ''}${output}` : '';

        });

    }

    get atmos() { return this._atmos; }
    get attributes() {
        const parts = [
            this.censored,
            this.hybrid ? 'Hybrid' : null,
            this.signLanguage ? `with ${this.signLanguage}` : null,
        ];
        return parts.filter(Boolean).join(' ');
    }
    get audio() {

        const parts: string[] = [];
        const plusParts: string[] = [];

        if (this._audioDescription) {
            parts.push('with Audio Description');
            plusParts.push('with Audio Description');
        }
        if (this._multiAudio) {
            parts.push(this._multiAudio);
            plusParts.push(this._multiAudio);
        }
        if (this._audioCodec) {
            parts.push(this._audioCodec.p);
            plusParts.push(this._audioCodec.plus);
        }
        if (this._channels) {
            parts.push(this._channels);
            plusParts.push(this._channels);
        }
        if (this._atmos) {
            parts.push('Atmos');
            plusParts.push('Atmos');
        }

        if (!parts.length) return null;

        return { p: parts.join(' '), plus: plusParts.join(' ') };

    }
    get audioCodec() { return this._audioCodec; }
    get audioDescription() { return this._audioDescription; }
    get category() { return this._category; }
    get censored() { return this._censored; }
    get channels() { return this._channels; }
    get dv() { return this._dv; }
    get dvProfile() { return this._dvProfile; }
    get edition() { return this._edition; }
    get episode() { return this._episode; }
    get episodeTitle() {
        if (!this._seasonOrEpisodeTitle) return null;
        if (this._episode === null) return null;
        return this._seasonOrEpisodeTitle;
    }
    get extension() { return this._extension; }
    get fileName() { return this._fileName; }
    get fullDisc() { return false; }
    get group() { return this._group; }
    get hdr() { return this._hdr; }
    get hybrid() { return this._hybrid; }
    get isSeasonPack() {
        if (this.category === 'movie') return false;
        if (this.episode !== null) return false;
        if (this.season === null) return false;
        if (this.season === 0) return false;
        return true;
    }
    get isSpecial() {
        if (this.category === 'movie') return false;
        if (this.isSeasonPack) return false;
        if (this.episode === 0 || this.season === 0) return true;
        return false;
    }
    get language() { return this._language; }
    get multiAudio() { return this._multiAudio; }
    get originalTitle() { return this._originalTitle; }
    get remux() { return this._remux; }
    get repack() { return this._repack; }
    get resolution() { return this._resolution; }
    get scanType() { return this._scanType; }
    get sdr() { return !this.dv && !this.hdr; }
    get season() { return this._season; }
    get seasonEpisode() { return this._seasonEpisode; }
    get seasonOrEpisodeTitle() { return this._seasonOrEpisodeTitle; }
    get seasonTitle() {
        if (!this._seasonOrEpisodeTitle) return null;
        if (!this.isSeasonPack) return null;
        return this._seasonOrEpisodeTitle;
    }
    get signLanguage() { return this._signLanguage; }
    get source() { return this._source; }
    get streamingService() { return this._streamingService; }
    get title() { return this._title; }
    get videoCodec() { return this._videoCodec; }
    get year() { return this._year; }

    inferRemuxSourceFromResolution() {

        if (!this._remux || !this._resolution || this._source) return;

        switch (this._resolution) {
            case '4320p': case '2160p': this._source = 'UHD BluRay'; break;
            case '1440p': case '1080p': case '1080i': case '720p': this._source = 'BluRay'; break;
            case '576p': case '576i': this._source = 'PAL DVD'; break;
            case '480p': case '480i': this._source = 'NTSC DVD'; break;
        }

    }

    /**
     * Parses video details from a release group string, starting from the end of the string and moving forward until
     * no explicit matches are found, then assumes whatever is left over is an episode name.
     * @param details A string like "1080p WEB-DL DDP5 1 H 264"
     */

    private parseVideoDetails(details: string) {

        let position = details.length;
        const consumed = new Set<string>();

        while (position > 0) {

            const remaining = details.substring(0, position);
            let matched = false;

            for (const matcher of detailMatchers) {

                if (!matcher.repeat && consumed.has(matcher.name)) continue;

                const match = remaining.match(matcher.pattern);
                if (!match) continue;

                consumed.add(matcher.name);
                matcher.apply(this, match);
                position -= match[0].length;
                matched = true;
                break;

            }

            if (!matched) {
                this.setSeasonOrEpisodeTitle(remaining);
                break;
            }

        }

    }

    setAtmos(atmos: boolean) {
        this._atmos = atmos;
    }

    setAudioCodec(codec: string | null) {

        if (!codec) {
            this._audioCodec = null;
            return;
        }

        const match = findTranslation(audioCodecs, codec);
        if (!match) throw Error(`Unrecognized audio codec: ${codec}`);

        this._audioCodec = match.codec;

        if ('atmos' in match) this._atmos = true;

    }

    setAudioDescription(audioDescription: boolean) {
        this._audioDescription = audioDescription;
    }

    setCategory(category: string | null) {

        if (!category) {
            this._category = null;
            return;
        }

        const lookup = category.toLowerCase().trim();
        const match = categories.find(name => name === lookup);
        if (!match) throw Error(`Unrecognized category: ${category}`);
        this._category = match;

    }

    setCensored(censored: string | null) {

        if (!censored) {
            this._censored = null;
            return;
        }

        const match = findTranslation(censoredStates, censored);
        if (!match) throw Error(`Unrecognized censored state: ${censored}`);
        this._censored = match.to;

    }

    setChannels(channels: string) {
        this._channels = channels.toLowerCase().trim().replace(/ /g, '.') || null;
    }

    setChannelLayout(layout: string) {

        const counts: Record<ChannelPosition, number> = { main: 0, lfe: 0, height: 0, floor: 0, object: 0 };

        for (const channel of layout.trim().split(' ')) {
            const position = channelPositionsByName.get(channel);
            if (!position) {
                log(`Found unknown audio channel type ${channel}, not updating channels from MediaInfo`, 'khaki');
                return;
            }
            counts[position]++;
        }

        let output = `${counts.main}.${counts.lfe}`;
        if (counts.height > 0 || counts.floor > 0) output += `.${counts.height}`;
        if (counts.floor > 0) output += `.${counts.floor}`;

        this._channels = output;

    }

    setDimensions(width: number, height: number, scanType?: string) {

        if (scanType === 'Interlaced' || scanType === 'Progressive') {
            this._scanType = scanType;
        }

        const interlaced = this._scanType === 'Interlaced';

        for (const rung of resolutions) {
            if (rung.width * 0.9 > width && rung.height * 0.9 > height) continue;
            this._resolution = interlaced && 'interlacedTo' in rung ? rung.interlacedTo : rung.to;
            this.inferRemuxSourceFromResolution();
            return;
        }

        /* Below the bottom of the ladder, so whatever the filename claimed is a
           better guess than anything we can offer */

    }

    setDv(dv: boolean, profile: DvProfile | null = null) {
        this._dv = dv;
        this._dvProfile = dv ? profile : null;
    }

    setEdition(edition: string | null) {

        if (!edition) {
            this._edition = null;
            return;
        }

        const match = findTranslation(editions, edition);
        if (!match) throw Error(`Unrecognized edition: ${edition}`);
        this._edition = match.to;

    }

    setExtension(extension: string) {
        this._extension = extension || null;
    }

    setGroup(group: string) {
        this._group = group || null;
    }

    setHdr(hdr: string | null) {

        if (!hdr) {
            this._hdr = null;
            return;
        }

        const lookup = hdr.toLowerCase().trim();

        const match = hdrFormats.find(row =>
            (row.from as readonly string[]).includes(lookup) ||
            ('mediaInfo' in row && (row.mediaInfo as readonly string[]).includes(lookup))
        );

        if (!match) throw Error(`Unrecognized HDR format: ${hdr}`);

        this._hdr = match.hdr;

    }

    setHdrFormat(
        format: string | undefined,
        profile: string | undefined,
        transferCharacteristics: string | undefined,
        maxCll: string | undefined
    ) {

        this.setDv(false);
        this.setHdr(null);

        if (profile) {

            const match = profile.match(/\bdv(?:he|me)\.(\d+)/i);

            if (match) {
                const dvProfile = parseInt(match[1]!, 10);
                if ((dvProfiles as readonly number[]).includes(dvProfile)) {
                    this.setDv(true, dvProfile as DvProfile);
                } else {
                    /* Still Dolby Vision, we just can't say which flavour */
                    log(`Unrecognized DV profile ${dvProfile}`, 'khaki');
                    this.setDv(true);
                }
            }

        }

        if (format) {

            const segments = format.split(' / ').map(segment => segment.toLowerCase().trim());

            const match = hdrFormats.find(row =>
                'mediaInfo' in row && (row.mediaInfo as readonly string[]).some(name => segments.includes(name))
            );

            if (match) this._hdr = match.hdr;

        } else if (transferCharacteristics === 'HLG') {
            this.setHdr('HLG');
        } else if (transferCharacteristics === 'PQ') {
            this.setHdr(maxCll ? 'HDR10' : 'PQ10');
        }

    }

    setHybrid(hybrid: boolean) {
        this._hybrid = hybrid;
    }

    setLanguage(input: string) {

        if (!input || input.toLowerCase() === 'und') {
            this._language = null;
            return;
        }

        const countryCodeMatches = input.match(/([a-z]{2,3})-[a-z0-9]{2,3}/i);
        if (countryCodeMatches && countryCodeMatches[1]) input = countryCodeMatches[1];

        const lookup = input.toLowerCase();
        let language: string | null = null;

        /* Codes before names, because a few names collide with another
           language's code — "ga" is both the Ga language of Ghana and the
           ISO-639-1 code for Irish, and MediaInfo only ever gives us codes. */
        for (const entry of iso6392) {
            if (
                entry.iso6392B.toLowerCase() === lookup ||
                entry.iso6392T?.toLowerCase() === lookup ||
                entry.iso6391?.toLowerCase() === lookup
            ) {
                language = entry.name.split('; ')[0]!;
                break;
            }
        }

        if (!language) {
            for (const entry of iso6392) {
                const name = entry.name.split('; ').find(name => name.toLowerCase() === lookup);
                if (name) {
                    language = name;
                    break;
                }
            }
        }

        /* Anything MediaInfo hands us that isn't in the list is still better
           than nothing, so this one keeps its passthrough */
        language ??= input;

        if (['en', 'eng', 'english'].includes(language.toLowerCase())) {
            this._language = null;
            return;
        }

        this._language = language.toUpperCase();

    }

    setMultiAudio(multiAudio: string | null) {

        if (!multiAudio) {
            this._multiAudio = null;
            return;
        }

        const match = findTranslation(multiAudioFormats, multiAudio);
        if (!match) throw Error(`Unrecognized multi audio format: ${multiAudio}`);
        this._multiAudio = match.to;

    }

    setOriginalTitle(title: string) {
        this._originalTitle = title.trim() || null;
    }

    setRemux(remux: boolean) {
        this._remux = remux;
        this.inferRemuxSourceFromResolution();
    }

    setRepack(repack: string | null) {

        if (!repack) {
            this._repack = null;
            return;
        }

        const lookup = repack.toLowerCase().trim();

        const aliases = Object.entries(repackAliases) as [string, Repack][];
        const alias = aliases.find(([name]) => name.toLowerCase() === lookup);
        if (alias) {
            this._repack = alias[1];
            return;
        }

        const match = repackNames.find(name => name.toLowerCase() === lookup);
        if (!match) throw Error(`Unrecognized repack: ${repack}`);
        this._repack = match;

    }

    setResolution(resolution: string | null) {

        if (!resolution) {
            this._resolution = null;
            this._scanType = null;
            return;
        }

        const lookup = resolution.toLowerCase().trim();
        const match = resolutionNames.find(name => name === lookup);
        if (!match) throw Error(`Unrecognized resolution: ${resolution}`);

        this._resolution = match;
        this._scanType = match.endsWith('i') ? 'Interlaced' : 'Progressive';

        this.inferRemuxSourceFromResolution();

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
        this._seasonOrEpisodeTitle = title.trim() || null;
    }

    setSignLanguage(signLanguage: string | null) {

        if (!signLanguage) {
            this._signLanguage = null;
            return;
        }

        const match = findTranslation(signLanguages, signLanguage);
        if (!match) throw Error(`Unrecognized sign language: ${signLanguage}`);
        this._signLanguage = match.to;

    }

    setSource(source: string | null) {

        if (!source) {
            this._source = null;
            return;
        }

        const match = findTranslation(sources, source);
        if (!match) throw Error(`Unrecognized source: ${source}`);
        this._source = match.to;

    }

    setStreamingService(streamingService: string | null) {

        if (!streamingService) {
            this._streamingService = null;
            return;
        }

        const lookup = streamingService.toLowerCase().trim();

        const canonical = streamingServices.find(name => name.toLowerCase() === lookup);
        if (canonical) {
            this._streamingService = canonical;
            return;
        }

        const entries = Object.entries(streamingServiceAliases) as [StreamingService, readonly string[]][];
        for (const [name, aliases] of entries) {
            if (aliases.some(alias => alias.toLowerCase() === lookup)) {
                this._streamingService = name;
                return;
            }
        }

        throw Error(`Unrecognized streaming service: ${streamingService}`);

    }

    setTitle(title: string) {
        this._title = title;
    }

    /**
     * @param preserveEncoder If true, setting something like "HEVC" won't clear
     * "x265" for example
     */

    setVideoCodec(codec: string | null, preserveEncoder = false) {

        if (!codec) {
            this._videoCodec = null;
            return;
        }

        /* This bit is a little bit gnarly. If we have an encoder from the
           filename, we don't want it to be overridden by MediaInfo if the file
           has had its encoding settings stripped, so we check if it's in the
           same family as the MediaInfo codec, and keep the encoder if it
           matches.

           So if the filename has x264 but MediaInfo just has AVC, we keep x264.
           But if the filename has x264 and MediaInfo has HEVC, we switch to
           H.265 or whatever. */

        const encoder = preserveEncoder ? this._videoCodec?.encoder : null;

        if (encoder) {

            const existing = videoCodecs.find(row => row.codec.encoder === encoder);

            if (existing) {
                const family: string[] = [
                    ...existing.from,
                    existing.codec.likeAvc.toLowerCase(),
                    existing.codec.likeH264.toLowerCase(),
                ];
                if (family.includes(codec.toLowerCase().trim())) codec = encoder;
            }

        }

        const match = findTranslation(videoCodecs, codec);
        if (!match) throw Error(`Unrecognized video codec: ${codec}`);

        this._videoCodec = match.codec;

    }

    setYear(year: number) {
        this._year = year === 0 ? null : year;
    }

    toJSON(): ReleaseState {
        return {
            atmos: this.atmos,
            attributes: this.attributes,
            audio: this.audio,
            audioCodec: this.audioCodec,
            audioDescription: this.audioDescription,
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
            hybrid: this.hybrid,
            isSeasonPack: this.isSeasonPack,
            isSpecial: this.isSpecial,
            language: this.language,
            multiAudio: this.multiAudio,
            originalTitle: this.originalTitle,
            remux: this.remux,
            repack: this.repack,
            resolution: this.resolution,
            scanType: this.scanType,
            sdr: this.sdr,
            season: this.season,
            seasonEpisode: this.seasonEpisode,
            seasonOrEpisodeTitle: this.seasonOrEpisodeTitle,
            seasonTitle: this.seasonTitle,
            signLanguage: this.signLanguage,
            source: this.source,
            streamingService: this.streamingService,
            title: this.title,
            videoCodec: this.videoCodec,
            year: this.year,
        };
    }

}
