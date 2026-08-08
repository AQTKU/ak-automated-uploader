/* The editable surface of Release, for the editor behind the filename on an upload page.

   Each field pairs its descriptor with the getter and setter it maps to, so the wire format, the
   current values and the mutation can't drift apart. Selects are keyed on the first `from` value
   of the row they come from rather than on what Release stores: `toJSON` emits translated values
   (`{ p: 'DDP', plus: 'DD+' }`) that no setter accepts, while a `from` value is guaranteed to
   round trip. */

import type { TrackerFieldState, FieldLayout } from '$lib/types';
import type Release from './release';
import {
    audioCodecs, categories, censoredStates, dvProfiles, editions, hdrFormats, multiAudioFormats,
    repackNames, resolutionNames, signLanguages, sources, streamingServices, videoCodecs,
    type DvProfile,
} from './release-tables';

type ReleaseFieldDefinition = {
    field: TrackerFieldState;
    get(release: Release): string | boolean;
    set(release: Release, value: string | boolean): void;
};

type Option = { id: string, label: string };

/* Every select can be emptied, and an empty value clears the underlying field */
function options(items: Option[]): Option[] {
    return [{ id: '', label: '-' }, ...items];
}

function tableOptions<T extends { readonly from: readonly string[] }>(
    table: readonly T[],
    label: (row: T) => string
): Option[] {
    return options(table.map(row => ({ id: row.from[0]!, label: label(row) })));
}

function listOptions(values: readonly (string | number)[]): Option[] {
    return options(values.map(value => ({ id: String(value), label: String(value) })));
}

/* Release stores the row's own translated object, so identity tells the rows apart where their
   contents can't — the `ddp` and `ddpa` rows both translate to DD+ */
function idOf<T extends { readonly from: readonly string[] }>(
    table: readonly T[],
    match: (row: T) => boolean
) {
    return table.find(match)?.from[0] ?? '';
}

/* Descriptors are spelled out the same way a tracker spells out its own fields, minus the `type`
   the helper already implies. `size` is characters, as it is there: the width of the input, or the
   minimum width of the select. */

type Descriptor = { id: string, label: string };
type SizedDescriptor = Descriptor & { size?: number };

function text(
    { id, label, size }: SizedDescriptor,
    get: (release: Release) => string | null,
    set: (release: Release, value: string) => void
): ReleaseFieldDefinition {
    return {
        field: { id, label, type: 'text', size },
        get: release => get(release) ?? '',
        set: (release, value) => set(release, String(value)),
    };
}

function select(
    { id, label, size, options: fieldOptions }: SizedDescriptor & { options: Option[] },
    get: (release: Release) => string,
    set: (release: Release, value: string | null) => void
): ReleaseFieldDefinition {
    return {
        field: { id, label, type: 'select', options: fieldOptions, size },
        get,
        set: (release, value) => set(release, String(value) || null),
    };
}

function checkbox(
    { id, label }: Descriptor,
    get: (release: Release) => boolean,
    set: (release: Release, value: boolean) => void
): ReleaseFieldDefinition {
    return {
        field: { id, label, type: 'checkbox' },
        get,
        set: (release, value) => set(release, value === true),
    };
}

const definitions: ReleaseFieldDefinition[] = [

    text({ id: 'fileName', label: 'Filename' },
        release => release.fileName,
        () => { throw Error('The filename is applied by re-parsing the release, not by a setter'); }),

    text({ id: 'title', label: 'Title' },
        release => release.title,
        (release, value) => release.setTitle(value)),

    text({ id: 'originalTitle', label: 'Original title' },
        release => release.originalTitle,
        (release, value) => release.setOriginalTitle(value)),

    select({ id: 'category', label: 'Category', size: 8, options: listOptions(categories) },
        release => release.category ?? '',
        (release, value) => release.setCategory(value)),

    text({ id: 'year', label: 'Year', size: 4 },
        release => release.year === null ? '' : String(release.year),
        (release, value) => release.setYear(parseInt(value, 10) || 0)),

    text({ id: 'seasonEpisode', label: 'Season/episode', size: 8 },
        release => release.seasonEpisode,
        (release, value) => release.setSeasonEpisode(value)),

    text({ id: 'seasonOrEpisodeTitle', label: 'Episode title' },
        release => release.seasonOrEpisodeTitle,
        (release, value) => release.setSeasonOrEpisodeTitle(value)),

    select({ id: 'resolution', label: 'Resolution', size: 8, options: listOptions(resolutionNames) },
        release => release.resolution ?? '',
        (release, value) => release.setResolution(value)),

    select({ id: 'source', label: 'Source', size: 11, options: tableOptions(sources, row => row.to) },
        release => idOf(sources, row => row.to === release.source),
        (release, value) => release.setSource(value)),

    select({ id: 'streamingService', label: 'Streaming service', size: 8, options: listOptions(streamingServices) },
        release => release.streamingService ?? '',
        (release, value) => release.setStreamingService(value)),

    select({ id: 'videoCodec', label: 'Video codec', size: 8, options: tableOptions(videoCodecs, row => row.codec.encoder ?? row.codec.likeH264) },
        release => idOf(videoCodecs, row => row.codec === release.videoCodec),
        (release, value) => release.setVideoCodec(value)),

    select({ id: 'audioCodec', label: 'Audio codec', size: 13, options: tableOptions(audioCodecs, row => 'atmos' in row ? `${row.codec.plus} Atmos` : row.codec.plus) },
        release => idOf(audioCodecs, row => row.codec === release.audioCodec),
        (release, value) => release.setAudioCodec(value)),

    text({ id: 'channels', label: 'Channels', size: 6 },
        release => release.channels,
        (release, value) => release.setChannels(value)),

    select({ id: 'multiAudio', label: 'Multi audio', size: 11, options: tableOptions(multiAudioFormats, row => row.to) },
        release => idOf(multiAudioFormats, row => row.to === release.multiAudio),
        (release, value) => release.setMultiAudio(value)),

    text({ id: 'language', label: 'Language', size: 12 },
        release => release.language,
        (release, value) => release.setLanguage(value)),

    select({ id: 'hdr', label: 'HDR format', size: 10, options: tableOptions(hdrFormats, row => row.hdr.plus) },
        release => idOf(hdrFormats, row => row.hdr === release.hdr),
        (release, value) => release.setHdr(value)),

    /* Picking a profile means the release is Dolby Vision, and clearing it leaves it that way */
    select({ id: 'dvProfile', label: 'DV profile', size: 5, options: listOptions(dvProfiles) },
        release => release.dvProfile === null ? '' : String(release.dvProfile),
        (release, value) => release.setDv(value ? true : release.dv, value ? Number(value) as DvProfile : null)),

    select({ id: 'edition', label: 'Edition', size: 19, options: tableOptions(editions, row => row.to) },
        release => idOf(editions, row => row.to === release.edition),
        (release, value) => release.setEdition(value)),

    select({ id: 'repack', label: 'Repack', size: 8, options: listOptions(repackNames) },
        release => release.repack ?? '',
        (release, value) => release.setRepack(value)),

    select({ id: 'censored', label: 'Censored', size: 11, options: tableOptions(censoredStates, row => row.to) },
        release => idOf(censoredStates, row => row.to === release.censored),
        (release, value) => release.setCensored(value)),

    select({ id: 'signLanguage', label: 'Sign language', size: 5, options: tableOptions(signLanguages, row => row.to) },
        release => idOf(signLanguages, row => row.to === release.signLanguage),
        (release, value) => release.setSignLanguage(value)),

    text({ id: 'group', label: 'Group', size: 12 },
        release => release.group,
        (release, value) => release.setGroup(value)),

    text({ id: 'extension', label: 'Extension', size: 5 },
        release => release.extension,
        (release, value) => release.setExtension(value)),

    checkbox({ id: 'remux', label: 'Remux' },
        release => release.remux,
        (release, value) => release.setRemux(value)),

    checkbox({ id: 'dv', label: 'Dolby Vision' },
        release => release.dv,
        (release, value) => release.setDv(value, release.dvProfile)),

    checkbox({ id: 'atmos', label: 'Atmos' },
        release => release.atmos,
        (release, value) => release.setAtmos(value)),

    checkbox({ id: 'hybrid', label: 'Hybrid' },
        release => release.hybrid,
        (release, value) => release.setHybrid(value)),

    checkbox({ id: 'audioDescription', label: 'Audio description' },
        release => release.audioDescription,
        (release, value) => release.setAudioDescription(value)),

];

export const releaseFileNameField = 'fileName';

export const releaseFields: TrackerFieldState[] = definitions.map(definition => definition.field);

export const releaseLayout: FieldLayout = [
    ['fileName', 'fileName', 'fileName', 'category'],
    ['title', 'title', 'originalTitle', 'originalTitle'],
    ['year', 'seasonEpisode', 'seasonOrEpisodeTitle', 'seasonOrEpisodeTitle'],
    ['resolution', 'source', 'remux', 'streamingService'],
    ['videoCodec', 'hdr', 'dv', 'dvProfile'],
    ['audioCodec', 'channels', 'atmos', 'multiAudio'],
    ['language', 'signLanguage', 'audioDescription', null],
    ['edition',  'censored', 'hybrid', null],
    [ 'group', 'repack', 'extension', null],
];

export function getReleaseValues(release: Release) {
    const output: Record<string, string | boolean> = {};
    for (const definition of definitions) output[definition.field.id] = definition.get(release);
    return output;
}

export function setReleaseValue(release: Release, key: string, value: string | boolean) {

    const definition = definitions.find(definition => definition.field.id === key);
    if (!definition) throw Error(`Couldn't find release field ${key}`);
    const { field } = definition;

    if (field.type === 'checkbox') {
        if (typeof value !== 'boolean') throw Error(`Couldn't set ${key}, expected boolean, got string`);
    } else {
        if (typeof value !== 'string') throw Error(`Couldn't set ${key}, expected string, got boolean`);
        if (field.type === 'select') {
            const ids = field.options.map(option => option.id);
            if (!ids.includes(value)) throw Error(`Couldn't set ${key}, must be one of: ${ids.join(', ')}`);
        }
    }

    definition.set(release, value);

}
