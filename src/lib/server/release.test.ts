import { describe, expect, test } from 'bun:test';
import Release from './release';
import { getReleaseValues, releaseFields, releaseLayout, setReleaseValue } from './release-fields';

describe('filename parsing', () => {

    test('parses a television episode', () => {
        const release = new Release('Show.Name.S01E05.Episode.Title.1080p.AMZN.WEB-DL.DDP5.1.H.264-GROUP.mkv');
        expect(release.category).toBe('tv');
        expect(release.title).toBe('Show Name');
        expect(release.seasonEpisode).toBe('S01E05');
        expect(release.season).toBe(1);
        expect(release.episode).toBe(5);
        expect(release.seasonOrEpisodeTitle).toBe('Episode Title');
        expect(release.resolution).toBe('1080p');
        expect(release.source).toBe('WEB-DL');
        expect(release.streamingService).toBe('AMZN');
        expect(release.group).toBe('GROUP');
        expect(release.extension).toBe('mkv');
    });

    test('parses a movie', () => {
        const release = new Release('Movie.Name.2019.UHD.BluRay.2160p.TrueHD.Atmos.7.1.DV.HEVC.REMUX-FraMeSToR.mkv');
        expect(release.category).toBe('movie');
        expect(release.title).toBe('Movie Name');
        expect(release.year).toBe(2019);
        expect(release.source).toBe('UHD BluRay');
        expect(release.resolution).toBe('2160p');
        expect(release.remux).toBe(true);
        expect(release.dv).toBe(true);
        expect(release.group).toBe('FraMeSToR');
    });

    test('leaves unrecognised tokens in the episode title rather than throwing', () => {
        const release = new Release('Show.Name.S01E01.Some.Betamax.Nonsense.1080p.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.seasonOrEpisodeTitle).toBe('Some Betamax Nonsense');
        expect(release.resolution).toBe('1080p');
    });

    test('a token is only consumed once', () => {
        const release = new Release('Movie.Name.2019.1080p.720p.BluRay.x264-GRP');
        expect(release.resolution).toBe('720p');
        expect(release.seasonOrEpisodeTitle).toBe('1080p');
    });

});

describe('season packs, episodes and specials', () => {

    test('a season pack has a season title and no episode title', () => {
        const release = new Release('Show.Name.S02.Season.Title.1080p.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.isSeasonPack).toBe(true);
        expect(release.isSpecial).toBe(false);
        expect(release.seasonTitle).toBe('Season Title');
        expect(release.episodeTitle).toBeNull();
    });

    test('episode zero is a special with an episode title, not a season title', () => {
        const release = new Release('Series.S03E00.Christmas.Special.720p.HDTV.x264-TLA');
        expect(release.episode).toBe(0);
        expect(release.isSeasonPack).toBe(false);
        expect(release.isSpecial).toBe(true);
        expect(release.episodeTitle).toBe('Christmas Special');
        expect(release.seasonTitle).toBeNull();
    });

    test('a normal episode has an episode title', () => {
        const release = new Release('Show.Name.S01E05.Episode.Title.1080p.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.episodeTitle).toBe('Episode Title');
        expect(release.seasonTitle).toBeNull();
    });

});

describe('audio', () => {

    test('builds the plain and plus variants', () => {
        const release = new Release('Show.Name.S01E01.1080p.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.audioCodec).toEqual({ p: 'DDP', plus: 'DD+' });
        expect(release.channels).toBe('5.1');
        expect(release.audio).toEqual({ p: 'DDP 5.1', plus: 'DD+ 5.1' });
    });

    test('is null until something sets it', () => {
        const release = new Release('Show.Name.S01E01.1080p.WEB-DL-GRP');
        expect(release.audio).toBeNull();
    });

    test('atmos comes from the codec as well as the filename tag', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.TrueHD.7.1.x264-GRP');
        expect(release.atmos).toBe(false);
        release.setAudioCodec('MLP FBA 16-ch');
        expect(release.atmos).toBe(true);
        expect(release.audioCodec?.p).toBe('TrueHD');
        expect(release.audio?.plus).toBe('TrueHD 7.1 Atmos');
    });

    test('orders audio description and multi audio ahead of the codec', () => {
        const release = new Release('Show.Name.S01E01.1080p.WEB-DL.DDP5.1.H.264-GRP');
        release.setMultiAudio('Dual-Audio');
        release.setAudioDescription(true);
        expect(release.audio?.plus).toBe('with Audio Description Dual-Audio DD+ 5.1');
    });

    test('counts MediaInfo channel layouts', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setChannelLayout('L R C LFE Ls Rs');
        expect(release.channels).toBe('5.1');
        release.setChannelLayout('L R C LFE Ls Rs Lb Rb');
        expect(release.channels).toBe('7.1');
        release.setChannelLayout('L R C LFE Ls Rs Tfl Tfr');
        expect(release.channels).toBe('5.1.2');
    });

    test('keeps the existing channels when a layout has an unknown position', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.DTS5.1.x264-GRP');
        release.setChannelLayout('L R Nonsense');
        expect(release.channels).toBe('5.1');
    });

});

describe('video', () => {

    test('exposes the codec under each naming convention', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        expect(release.videoCodec).toEqual({ likeAvc: 'AVC', likeH264: 'H.264', encoder: 'x264' });
    });

    test('narrowing one half of the codec narrows the other', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        if (release.videoCodec?.likeAvc === 'HEVC') {
            /* Only reachable if likeH264 is H.265, which is the point — this
               would not compile if the type were a cross product */
            const likeH264: 'H.265' = release.videoCodec.likeH264;
            expect(likeH264).toBe('H.265');
        }
        expect(release.videoCodec?.likeAvc).toBe('AVC');
    });

    test('keeps the filename encoder when MediaInfo agrees on the family', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setVideoCodec('AVC', true);
        expect(release.videoCodec?.encoder).toBe('x264');
    });

    test('drops the filename encoder when MediaInfo disagrees', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setVideoCodec('HEVC', true);
        expect(release.videoCodec).toEqual({ likeAvc: 'HEVC', likeH264: 'H.265', encoder: null });
    });

    test('takes the codec as given when the encoder is named on purpose', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setVideoCodec('AVC');
        expect(release.videoCodec).toEqual({ likeAvc: 'AVC', likeH264: 'H.264', encoder: null });
    });

});

describe('HDR and Dolby Vision', () => {

    test('keeps the most specific tag when a filename stacks them', () => {
        const release = new Release('Show.Name.S02.1080p.WEB-DL.DDP5.1.HDR.HDR10Plus.H.265-GRP');
        expect(release.hdr?.plus).toBe('HDR10+');
        expect(release.seasonOrEpisodeTitle).toBeNull();
    });

    test('prefers HDR10+ over the ST 2086 metadata it also carries', () => {
        const release = new Release('Movie.Name.2019.2160p.UHD.BluRay.x265-GRP');
        release.setHdrFormat('SMPTE ST 2086 / SMPTE ST 2094 App 4', undefined, 'PQ', 1000);
        expect(release.hdr?.plus).toBe('HDR10+');
    });

    test('falls back to transfer characteristics when there is no HDR format', () => {
        const release = new Release('Movie.Name.2019.2160p.UHD.BluRay.x265-GRP');
        release.setHdrFormat(undefined, undefined, 'PQ', 1000);
        expect(release.hdr).toEqual({ short: 'HDR', plus: 'HDR', long: 'HDR10' });
        release.setHdrFormat(undefined, undefined, 'PQ', undefined);
        expect(release.hdr?.plus).toBe('PQ10');
        release.setHdrFormat(undefined, undefined, 'HLG', undefined);
        expect(release.hdr?.plus).toBe('HLG');
    });

    test('reads the Dolby Vision profile out of the HDR format profile', () => {
        const release = new Release('Movie.Name.2019.2160p.UHD.BluRay.x265-GRP');
        release.setHdrFormat('Dolby Vision / SMPTE ST 2086', 'dvhe.08.06', 'PQ', 1000);
        expect(release.dv).toBe(true);
        expect(release.dvProfile).toBe(8);
        expect(release.hdr?.long).toBe('HDR10');
        expect(release.sdr).toBe(false);
    });

    test('flags Dolby Vision even when the profile is one we do not know', () => {
        const release = new Release('Movie.Name.2019.2160p.UHD.BluRay.x265-GRP');
        release.setHdrFormat('Dolby Vision', 'dvhe.99.06', undefined, undefined);
        expect(release.dv).toBe(true);
        expect(release.dvProfile).toBeNull();
    });

    test('is SDR with neither', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        expect(release.sdr).toBe(true);
    });

});

describe('sources and streaming services', () => {

    test('separates the service from the source', () => {
        const release = new Release('Show.Name.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.source).toBe('WEB-DL');
        expect(release.streamingService).toBe('NF');
    });

    test('translates spelled out services to their tags', () => {
        expect(new Release('Some.Doc.2021.Netflix.WEB-DL.1080p.DD5.1.H.264-ABC').streamingService).toBe('NF');
        expect(new Release('Some.Doc.2021.Criterion.WEB-DL.1080p.DD5.1.H.264-ABC').streamingService).toBe('CRIT');
        expect(new Release('Some.Doc.2021.Amazon.WEB-DL.1080p.DD5.1.H.264-ABC').streamingService).toBe('AMZN');
    });

    test('leaves an unknown service in the episode title', () => {
        const release = new Release('Show.Name.S01E01.Title.NOTASERVICE.WEB-DL.1080p.DDP5.1.H.264-GRP');
        expect(release.source).toBe('WEB-DL');
        expect(release.streamingService).toBeNull();
        expect(release.seasonOrEpisodeTitle).toBe('Title NOTASERVICE');
    });

    test('infers the remux source from the resolution', () => {
        expect(new Release('Movie.Name.2019.2160p.REMUX.HEVC-GRP').source).toBe('UHD BluRay');
        expect(new Release('Movie.Name.2019.1080p.REMUX.AVC-GRP').source).toBe('BluRay');
        expect(new Release('Movie.Name.2019.576i.REMUX.MPEG-2-GRP').source).toBe('PAL DVD');
        expect(new Release('Movie.Name.2019.480i.REMUX.MPEG-2-GRP').source).toBe('NTSC DVD');
    });

});

describe('resolution', () => {

    test('reads dimensions off MediaInfo', () => {
        const release = new Release('Movie.Name.2019.BluRay.x264-GRP');
        release.setDimensions(3840, 2160);
        expect(release.resolution).toBe('2160p');
        release.setDimensions(2560, 1440);
        expect(release.resolution).toBe('1440p');
    });

    test('gives a cropped encode the rung it was cropped from', () => {
        const release = new Release('Movie.Name.2019.BluRay.x264-GRP');
        release.setDimensions(1920, 800);
        expect(release.resolution).toBe('1080p');
    });

    test('only uses interlaced variants where they exist', () => {
        const release = new Release('Movie.Name.2019.BluRay.x264-GRP');
        release.setDimensions(1920, 1080, 'Interlaced');
        expect(release.resolution).toBe('1080i');
        expect(release.scanType).toBe('Interlaced');
        release.setDimensions(3840, 2160, 'Interlaced');
        expect(release.resolution).toBe('2160p');
    });

    test('keeps the filename resolution below the bottom of the ladder', () => {
        const release = new Release('Movie.Name.2019.480p.DVD.x264-GRP');
        expect(release.resolution).toBe('480p');
        release.setDimensions(320, 240);
        expect(release.resolution).toBe('480p');
    });

    test('stays unknown when neither the filename nor the dimensions say', () => {
        const release = new Release('Movie.Name.2019.DVD.x264-GRP');
        release.setDimensions(320, 240);
        expect(release.resolution).toBeNull();
    });

    test('sets the scan type from the filename', () => {
        expect(new Release('Movie.Name.2019.1080i.HDTV.x264-GRP').scanType).toBe('Interlaced');
        expect(new Release('Movie.Name.2019.1080p.BluRay.x264-GRP').scanType).toBe('Progressive');
    });

});

describe('editions, attributes and repacks', () => {

    test('an edition and a rating tag coexist', () => {
        const release = new Release('Movie.Title.1998.Extended.UNRATED.1080p.BluRay.DTS-HD.MA.5.1.x264-GRP');
        expect(release.edition).toBe('Extended');
        expect(release.censored).toBe('UNRATED');
    });

    test('collects attributes into one string', () => {
        const release = new Release('Show.S01E03.UNCUT.Hybrid.with.ASL.1080p.WEB-DL.DDP5.1.H.264-NTb');
        expect(release.censored).toBe('UNCUT');
        expect(release.hybrid).toBe(true);
        expect(release.signLanguage).toBe('ASL');
        expect(release.attributes).toBe('UNCUT Hybrid with ASL');
    });

    test('canonicalises repack forms', () => {
        expect(new Release('Movie.Name.2019.repack.1080p.BluRay.x264-GRP').repack).toBe('REPACK');
        expect(new Release('Movie.Name.2019.REPACK2.1080p.BluRay.x264-GRP').repack).toBe('REPACK2');
        expect(new Release('Movie.Name.2019.PROPER.1080p.BluRay.x264-GRP').repack).toBe('PROPER');
        expect(new Release('Show.Name.S01E01.v2.1080p.WEB-DL.DDP5.1.H.264-GRP').repack).toBe('v2');
    });

    test('collapses a redundant first repack', () => {
        const release = new Release('Movie.Name.2019.REPACK1.1080p.BluRay.x264-GRP');
        expect(release.repack).toBe('REPACK');
        expect(release.seasonOrEpisodeTitle).toBeNull();
    });

});

describe('language', () => {

    test('matches shouty and lowercase language names', () => {
        expect(new Release('Anime.S01E01.SPANiSH.1080p.WEB-DL.AAC2.0.H.264-GRP').language).toBe('SPANISH');
        expect(new Release('Anime.S01E01.SPANISH.1080p.WEB-DL.AAC2.0.H.264-GRP').language).toBe('SPANISH');
    });

    test('ignores title case, which is usually just part of the episode title', () => {
        const release = new Release('Lucy.Learns.Spanish.S01E02.1080p.WEB-DL.AAC2.0.H.264-XYZ');
        expect(release.language).toBeNull();
        expect(release.title).toBe('Lucy Learns Spanish');
    });

    test('resolves MediaInfo codes, preferring codes over colliding names', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setLanguage('ga');
        expect(release.language).toBe('IRISH');
        release.setLanguage('fra');
        expect(release.language).toBe('FRENCH');
        release.setLanguage('ja');
        expect(release.language).toBe('JAPANESE');
    });

    test('treats English as unremarkable', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setLanguage('eng');
        expect(release.language).toBeNull();
        release.setLanguage('und');
        expect(release.language).toBeNull();
    });

    test('strips a country code', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setLanguage('pt-BR');
        expect(release.language).toBe('PORTUGUESE');
    });

});

describe('format', () => {

    test('renders a title', () => {
        const release = new Release('Show.Name.S01E05.Episode.Title.1080p.AMZN.WEB-DL.DDP5.1.H.264-GROUP.mkv');
        expect(release.format('{title} {season_episode} {resolution} {source} {audio plus} {video like_h264}-{group}'))
            .toBe('Show Name S01E05 1080p AMZN WEB-DL DD+ 5.1 H.264-GROUP');
    });

    test('puts the streaming service back in front of the source', () => {
        const release = new Release('Show.Name.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.format('{source}')).toBe('NF WEB-DL');
    });

    test('falls back to NOGROUP when asked', () => {
        const release = new Release('Show.Name.S01E01.1080p.WEB-DL.DDP5.1.H.264');
        expect(release.group).toBeNull();
        expect(release.format('-{group or_NOGROUP}')).toBe('-NOGROUP');
        expect(release.format('-{group}')).toBe('');
    });

    test('drops empty tags along with their leading separator', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        expect(release.format('{title} {year} {edition} {repack} {resolution}')).toBe('Movie Name 2019 1080p');
    });

    test('honours the conditional arguments', () => {
        const release = new Release('Show.Name.S01E01.SPANiSH.1080p.WEB-DL.DDP5.1.H.264-GRP');
        expect(release.format('{language if_not_dual_audio}')).toBe('SPANISH');
        release.setMultiAudio('Dual-Audio');
        expect(release.format('{language if_not_dual_audio}')).toBe('');
        expect(release.format('{title if_special}')).toBe('');
    });

    test('prefixes the video tag with DV and HDR', () => {
        const release = new Release('Movie.Name.2019.2160p.UHD.BluRay.HDR10+.DV.x265-GRP');
        expect(release.format('{video encoder}')).toBe('DV HDR10+ x265');
    });

    test('adds the AKA title when it differs', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setOriginalTitle('Nombre de la Película');
        expect(release.format('{title aka}')).toBe('Movie Name AKA Nombre de la Película');
    });

});

describe('unknown values', () => {

    test('setters reject anything not in the tables', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        expect(() => release.setSource('Betamax')).toThrow();
        expect(() => release.setAudioCodec('MP2')).toThrow();
        expect(() => release.setVideoCodec('DivX')).toThrow();
        expect(() => release.setResolution('540p')).toThrow();
        expect(() => release.setEdition('Fan Edit')).toThrow();
        expect(() => release.setStreamingService('NOTASERVICE')).toThrow();
        expect(() => release.setRepack('REPACKED')).toThrow();
    });

    test('an unknown language still passes through', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        release.setLanguage('qqq');
        expect(release.language).toBe('QQQ');
    });

});

describe('editing', () => {

    test('every closed-set setter clears on null', () => {

        const release = new Release('Movie.Name.2019.Extended.UNCUT.REPACK.Hybrid.2160p.AMZN.WEB-DL.HDR.DDP5.1.Atmos.with.ASL.x265-GRP');

        release.setAudioCodec(null);
        release.setCategory(null);
        release.setCensored(null);
        release.setEdition(null);
        release.setMultiAudio(null);
        release.setRepack(null);
        release.setResolution(null);
        release.setSignLanguage(null);
        release.setSource(null);
        release.setStreamingService(null);
        release.setVideoCodec(null);
        release.setHdr(null);

        expect(release.audioCodec).toBeNull();
        expect(release.category).toBeNull();
        expect(release.censored).toBeNull();
        expect(release.edition).toBeNull();
        expect(release.multiAudio).toBeNull();
        expect(release.repack).toBeNull();
        expect(release.resolution).toBeNull();
        expect(release.signLanguage).toBeNull();
        expect(release.source).toBeNull();
        expect(release.streamingService).toBeNull();
        expect(release.videoCodec).toBeNull();
        expect(release.hdr).toBeNull();

    });

    test('clearing the resolution clears the scan type with it', () => {
        const release = new Release('Movie.Name.2019.1080i.HDTV.x264-GRP');
        expect(release.scanType).toBe('Interlaced');
        release.setResolution(null);
        expect(release.scanType).toBeNull();
    });

    test('the category can be corrected after a misparse', () => {
        const release = new Release('Movie.Name.2019.1080p.BluRay.x264-GRP');
        expect(release.category).toBe('movie');
        release.setCategory('tv');
        expect(release.category).toBe('tv');
        expect(() => release.setCategory('documentary')).toThrow();
    });

});

describe('release fields', () => {

    const release = new Release('Show.Name.S01E05.Episode.Title.2160p.AMZN.WEB-DL.HDR10Plus.DDP5.1.Atmos.DV.x265-GROUP.mkv');

    test('offers every option as something a setter accepts', () => {
        for (const field of releaseFields) {
            if (field.type !== 'select') continue;
            for (const option of field.options) {
                expect(() => setReleaseValue(new Release(''), field.id, option.id)).not.toThrow();
            }
        }
    });

    test('round trips its own values', () => {

        const values = getReleaseValues(release);
        const before = release.toJSON();

        for (const [key, value] of Object.entries(values)) {
            if (key === 'fileName') continue;
            setReleaseValue(release, key, value);
        }

        expect(release.toJSON()).toEqual(before);

    });

    test('rejects unknown fields and out of range options', () => {
        expect(() => setReleaseValue(release, 'nonsense', 'x')).toThrow();
        expect(() => setReleaseValue(release, 'source', 'betamax')).toThrow();
        expect(() => setReleaseValue(release, 'remux', 'yes')).toThrow();
        expect(() => setReleaseValue(release, 'title', true)).toThrow();
    });

    test("refuses to set the filename, which is the parser's input", () => {
        expect(() => setReleaseValue(release, 'fileName', 'Other.Name.mkv')).toThrow();
    });

    test('every laid out area is a field, and every field is laid out', () => {
        const ids = releaseFields.map(field => field.id).sort();
        const areas = [...new Set(releaseLayout.flat().filter(area => area !== null))].sort();
        expect(areas).toEqual(ids);
    });

});

describe('toJSON', () => {

    test('matches the getters', () => {
        const release = new Release('Show.Name.S01E05.Episode.Title.1080p.AMZN.WEB-DL.DDP5.1.H.264-GROUP.mkv');
        const state = release.toJSON();
        expect(state.title).toBe(release.title);
        expect(state.audio).toEqual(release.audio);
        expect(state.seasonTitle).toBe(release.seasonTitle);
        expect(state.seasonOrEpisodeTitle).toBe(release.seasonOrEpisodeTitle);
        expect(state.attributes).toBe(release.attributes);
        expect(state.fileName).toBe('Show.Name.S01E05.Episode.Title.1080p.AMZN.WEB-DL.DDP5.1.H.264-GROUP.mkv');
    });

});
