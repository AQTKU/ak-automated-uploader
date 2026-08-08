/* Data tables for Release.

   Every `from` value is compared against lowercased input, and the filename
   parsing regular expressions in release.ts are built from these same lists.
   That's the invariant that lets the setters throw on anything they don't
   recognise: if the parser matched it, a translation exists. */

type Row = { from: string[], to: string };

/* The translated value is nested rather than spread across the row so that the
   derived type is a union of the pairs that actually exist, instead of every
   combination of their halves. */

type AudioCodecRow = { from: string[], codec: { p: string, plus: string }, atmos?: boolean };

export const audioCodecs = [
    { 
        from: ['aac', 'aac lc'], 
        codec: { p: 'AAC', plus: 'AAC' } 
    }, { 
        from: ['alac'], 
        codec: { p: 'ALAC', plus: 'ALAC' } 
    }, { 
        from: ['dd', 'ac-3'], 
        codec: { p: 'DD', plus: 'DD' } 
    }, { 
        from: ['ddp', 'dd+', 'e-ac-3'], 
        codec: { p: 'DDP', plus: 'DD+' } 
    }, { 
        from: ['ddpa', 'ddp atmos', 'dd+ atmos', 'e-ac-3 joc'], 
        codec: { p: 'DDP', plus: 'DD+' }, 
        atmos: true 
    }, { 
        from: ['dts'], 
        codec: { p: 'DTS', plus: 'DTS' } 
    }, { 
        from: ['dts-hd ma', 'dts xll'], 
        codec: { p: 'DTS-HD MA', plus: 'DTS-HD MA' } 
    }, { 
        from: ['dts-x', 'dts xll x'], 
        codec: { p: 'DTS:X', plus: 'DTS:X' } 
    }, { 
        from: ['flac'], 
        codec: { p: 'FLAC', plus: 'FLAC' } 
    }, { 
        from: ['mp3', 'mpeg audio'], 
        codec: { p: 'MP3', plus: 'MP3' } 
    }, { 
        from: ['opus'], 
        codec: { p: 'Opus', plus: 'Opus' } 
    }, { 
        from: ['pcm'], 
        codec: { p: 'LPCM', plus: 'LPCM' } 
    }, { 
        from: ['truehd', 'mlp fba'], 
        codec: { p: 'TrueHD', plus: 'TrueHD' } 
    }, { 
        from: ['truehd atmos', 'mlp fba 16-ch', 'mlp fba ac-3 16-ch'], 
        codec: { p: 'TrueHD', plus: 'TrueHD' }, 
        atmos: true 
    }, { 
        from: ['vorbis'], 
        codec: { p: 'Vorbis', plus: 'Vorbis' } 
    },
] as const satisfies AudioCodecRow[];

export type AudioCodec = typeof audioCodecs[number]['codec'];

export const multiAudioFormats = [
    { from: ['dual', 'dual audio', 'dual-audio'], to: 'Dual-Audio' },
    { from: ['multi', 'multilang', 'multi-audio', 'multilingual'], to: 'Multi' },
] as const satisfies Row[];

export type MultiAudio = typeof multiAudioFormats[number]['to'];

export const channelPositions = {
    main: ['C', 'Rc', 'R', 'Rw', 'Rss', 'Rs', 'Rsd', 'Rb', 'Cb', 'Lb', 'Lsd', 'Ls', 'Lss', 'Lw', 'L', 'Lc'],
    lfe: ['LFE', 'LFE2'],
    height: ['Tfc', 'Tfr', 'Tsr', 'Rvs', 'Tbr', 'Tbc', 'Tbl', 'Lvs', 'Tsl', 'Tfl', 'Tc'],
    floor: ['Bfc', 'Bfr', 'Bsr', 'Bbr', 'Bbc', 'Bbl', 'Bsl', 'Bfl'],
    // Positional audio from DTS:X, counted in no channel group
    object: ['Objects'],
} as const satisfies Record<string, string[]>;

export type ChannelPosition = keyof typeof channelPositions;

type VideoCodecRow = { from: string[], codec: { likeAvc: string, likeH264: string, encoder: string | null } };

export const videoCodecs = [
    { from: ['av1'], codec: { likeAvc: 'AV1', likeH264: 'AV1', encoder: null } },
    { from: ['mpeg video', 'mpeg-2'], codec: { likeAvc: 'MPEG-2', likeH264: 'MPEG-2', encoder: null } },
    { from: ['vp9'], codec: { likeAvc: 'VP9', likeH264: 'VP9', encoder: null } },
    { from: ['x264'], codec: { likeAvc: 'AVC', likeH264: 'H.264', encoder: 'x264' } },
    { from: ['avc', 'h264', 'h 264', 'h.264'], codec: { likeAvc: 'AVC', likeH264: 'H.264', encoder: null } },
    { from: ['x265'], codec: { likeAvc: 'HEVC', likeH264: 'H.265', encoder: 'x265' } },
    { from: ['hevc', 'h265', 'h 265', 'h.265'], codec: { likeAvc: 'HEVC', likeH264: 'H.265', encoder: null } },
] as const satisfies VideoCodecRow[];

export type VideoCodec = typeof videoCodecs[number]['codec'];

type HdrRow = { from: string[], mediaInfo?: string[], hdr: { short: string, plus: string, long: string } };

/* Order matters: an HDR10+ stream also carries the ST 2086 metadata that plain
   HDR10 is identified by, so the more specific formats have to come first.
   It's technically possible to have more HDR metadata layers than just one of
   these plus DV, but that's not usually representable by tracker upload forms
   so we're just not going to support that case. If a file has 3+ HDR layers,
   the user can correct the torrent title manually. */
export const hdrFormats = [
    { from: ['hdr10+', 'hdr10p', 'hdr10plus'], mediaInfo: ['smpte st 2094 app 4'], hdr: { short: 'HDR', plus: 'HDR10+', long: 'HDR10Plus' } },
    { from: ['hdr vivid'], mediaInfo: ['hdr vivid'], hdr: { short: 'HDR', plus: 'HDR Vivid', long: 'HDR Vivid' } },
    { from: ['hdr', 'hdr10'], mediaInfo: ['smpte st 2086'], hdr: { short: 'HDR', plus: 'HDR', long: 'HDR10' } },
    { from: ['hlg'], hdr: { short: 'HLG', plus: 'HLG', long: 'HLG' } },
    { from: ['pq10'], hdr: { short: 'PQ', plus: 'PQ10', long: 'PQ10' } },
] as const satisfies HdrRow[];

export type Hdr = typeof hdrFormats[number]['hdr'];

export const dvProfiles = [5, 7, 8, 10, 20] as const;

export type DvProfile = typeof dvProfiles[number];

type ResolutionRow = { to: string, width: number, height: number, interlacedTo?: string };

export const resolutions = [
    { to: '4320p', width: 8192, height: 4320 },
    { to: '2160p', width: 3840, height: 2160 },
    { to: '1440p', width: 2560, height: 1440 },
    { to: '1080p', width: 1920, height: 1080, interlacedTo: '1080i' },
    { to: '720p', width: 1280, height: 720 },
    { to: '576p', width: 1024, height: 576, interlacedTo: '576i' },
    { to: '480p', width: 854, height: 480, interlacedTo: '480i' },
] as const satisfies ResolutionRow[];

export type Resolution =
    | typeof resolutions[number]['to']
    | Extract<typeof resolutions[number], { interlacedTo: string }>['interlacedTo'];

export const resolutionNames = resolutions.flatMap(row =>
    'interlacedTo' in row ? [row.to, row.interlacedTo] : [row.to]
);

type SourceRow = { from: string[], to: string, streaming?: boolean };

export const sources = [
    { from: ['web', 'webdl', 'web-dl'], to: 'WEB-DL', streaming: true },
    { from: ['webrip', 'web-rip', 'webcap', 'web-cap'], to: 'WEBRip', streaming: true },
    { from: ['bluray', 'blu-ray', 'hd bluray', 'hd blu-ray', 'bdrip', 'brrip'], to: 'BluRay' },
    { from: ['uhd bluray', 'uhd blu-ray', 'uhd brrip'], to: 'UHD BluRay' },
    { from: ['hd-dvd', 'hddvd', 'hd dvd'], to: 'HD-DVD' },
    { from: ['pal dvd'], to: 'PAL DVD' },
    { from: ['ntsc dvd'], to: 'NTSC DVD' },
    { from: ['dvd', 'dvd5', 'dvd9'], to: 'DVD' },
    { from: ['dvdrip'], to: 'DVDRip' },
    { from: ['hdtv'], to: 'HDTV' },
    { from: ['sdtv'], to: 'SDTV' },
] as const satisfies SourceRow[];

export type Source = typeof sources[number]['to'];

/* Is it a good idea to canonicalize streaming service names?
   ✨ Probably not, but I did it anyway! ✨ */

export const streamingServices = [
    '35MM', '9NOW', 'AE', 'AUBC', 'AMBC', 'ACORN', 'AS', 'AJAZ', 'ALL4', 'AMZN',
    'AMC', 'AMCP', 'ATK', 'ANGL', 'ADN', 'ANPL', 'ANLB', 'AOL', 'ATV', 'ATVP',
    'ARD', 'ARTE', 'A3P', 'iP', 'BB', 'BK', 'BNGE', 'BKPL', 'BOOM', 'BRAV',
    'BRTB', 'CMOR', 'CNLP', 'CN', 'CBC', 'CBS', 'MY5', 'CHGD', 'CRKI', 'CMAX',
    'CM', 'CNB', 'CLBI', 'CNBC', 'CCGC', 'CC', 'COOK', 'CMT', 'CRKL', 'CRAV',
    'CRIT', 'CR', 'CSPN', 'CTV', 'CUR', 'CRZN', 'CW', 'CWS', 'DLWP', 'DSKI',
    'DAZN', 'DCU', 'DHF', 'DEST', 'DDY', 'DTV', 'DISC', 'DSCP', 'DSNY', 'DSNP',
    'APPS', 'DIY', 'DOCC', 'DOCPLAY', 'DPLY', 'DF', 'DRPO', 'DRTV', 'ETV',
    'ETTV', 'EPIX', 'ESPN', 'ESQ', 'EYE', 'FBW', 'FAM', 'FJR', 'FNDG', 'FSTV',
    'FLMN', 'FMIO', 'FOOD', 'FOX', 'FXTL', 'FPT', 'FTV', 'FREE', 'FUBO', 'FUNI',
    'FYI', 'GAGA', 'GLBL', 'GLBO', 'GLOB', 'GO90', 'PLAY', 'HLMK', 'HBO',
    'HMAX', 'HGTV', 'HIDI', 'HIST', 'HS', 'HTSR', 'HULU', 'HGM', 'HPLAY', 'TOU',
    'IFC', 'INFP', 'ID', 'iQIYI', 'iT', 'ITV', 'IVI', 'JC', 'JHS', 'JUAN', 'KS',
    'KNPY', 'KAYO', 'KF', 'KNOW', 'KCW', 'KPN', 'LeTV', 'LBXD', 'LIFE', 'LGP',
    'LN', 'MMAX', 'MAX', 'MBC', 'MS', 'MX', 'MTOD', 'MA', 'MNBC', 'MTV', 'MUBI',
    'NFB', 'NATG', 'NBA', 'NBC', 'NBLA', 'NF', 'NFL', 'NFLN', 'GC', 'NICK',
    'NRK', 'NOW', 'NPO', 'ODK', 'OFTV', 'OPTO', 'OSN', 'OUTV', 'OXGN', 'PMNT',
    'PMTP', 'PBS', 'PBSK', 'PCOK', 'PLYR', 'PSN', 'PLUZ', 'POGO', 'PA', 'PUHU',
    'QIBI', 'RKTN', 'ROKU', 'RSTR', 'RTE', 'SAINA', 'SBS', 'SESO', 'SF',
    'SHAHID', 'SHMI', 'SMAX', 'SHO', 'SHDR', 'SS', 'SKSH', 'SKSP', 'SKSTR',
    'SKST', 'SLNG', 'SLIV', 'BCORE', 'SPIK', 'SNET', 'SPRT', 'STAN', 'STRP',
    'STZ', 'STMZ', 'SNXT', 'SVT', 'SWER', 'SWEET', 'SYFY', 'TBS', 'TEN', 'TK',
    'TFOU', 'TIMV', 'TLC', 'TRVL', 'TUBI', 'TV3', 'TV4', 'TVING', 'TVL', 'TVNZ',
    'UFC', 'UKTV', 'UNXT', 'UNIV', 'USAN', 'VLCT', 'VTRN', 'VH1', 'VIAP', 'VICE',
    'VLD', 'VDO', 'VIKI', 'VMEO', 'VIU', 'VMX', 'VVMX', 'VRV', 'VUDU', 'WNET',
    'WTCH', 'WME', 'WOWP', 'WWEN', 'XBOX', 'XUMO', 'YHOO', 'YOUKU', 'YT', 'RED',
    'ZDF', 'ZEE5',
] as const;

export type StreamingService = typeof streamingServices[number];

export const streamingServiceAliases = {
    AMZN: ['Amazon'],
    ATVP: ['ATV+', 'AppleTV+'],
    BCORE: ['CORE'],
    CNLP: ['CNL+', 'Canal+'],
    CRAV: ['Crave'],
    CRIT: ['Criterion'],
    DRPO: ['Dropout'],
    DSNP: ['Disney+'],
    NBLA: ['Nebula'],
    NF: ['Netflix'],
    OUTV: ['OUTTV'],
    PLAY: ['GPLAY'],
    PMTP: ['PMT+', 'Paramount+'],
    iP: ['iPlayer'],
} as const satisfies Partial<Record<StreamingService, string[]>>;

export const editions = [
    { from: ['alternative cut', 'alternate cut'], to: 'Alternative Cut' },
    { from: ['collectors edition', "collector's edition"], to: "Collector's Edition" },
    { from: ['directors cut', "director's cut", 'directors edition', "director's edition"], to: "Director's Cut" },
    { from: ['extended cut', 'extended edition', 'extended'], to: 'Extended' },
    { from: ['limited edition', 'limited'], to: 'Limited Edition' },
    { from: ['special edition'], to: 'Special Edition' },
    { from: ['theatrical cut', 'theatrical'], to: 'Theatrical Cut' },
] as const satisfies Row[];

export type Edition = typeof editions[number]['to'];

export const censoredStates = [
    { from: ['censored'], to: 'CENSORED' },
    { from: ['uncensored'], to: 'UNCENSORED' },
    { from: ['uncut'], to: 'UNCUT' },
    { from: ['unrated'], to: 'UNRATED' },
] as const satisfies Row[];

export type Censored = typeof censoredStates[number]['to'];

export const signLanguages = [
    { from: ['asl'], to: 'ASL' },
    { from: ['bsl'], to: 'BSL' },
] as const satisfies Row[];

export type SignLanguage = typeof signLanguages[number]['to'];

export const repackKinds = ['REPACK', 'PROPER', 'DIRFIX'] as const;

const repackDigits = ['2', '3', '4', '5', '6', '7', '8', '9'] as const;

type RepackDigit = typeof repackDigits[number];

export type Repack =
    | `${typeof repackKinds[number]}${'' | RepackDigit}`
    | `v${RepackDigit}`;

export const repackNames: Repack[] = [];
for (const kind of repackKinds) {
    repackNames.push(kind);
    for (const digit of repackDigits) repackNames.push(`${kind}${digit}`);
}
for (const digit of repackDigits) repackNames.push(`v${digit}`);

export const repackAliases = {
    REPACK1: 'REPACK',
    PROPER1: 'PROPER',
    DIRFIX1: 'DIRFIX',
} as const satisfies Record<string, Repack>;

export const scanTypes = ['Interlaced', 'Progressive'] as const;

export type ScanType = typeof scanTypes[number];

export const categories = ['tv', 'movie'] as const;

export type Category = typeof categories[number];
