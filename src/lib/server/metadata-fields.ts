import * as v from 'valibot';
import type { FieldLayout, Metadata, TrackerFieldState } from '$lib/types';
import { categories, type Category } from './release-tables';

type MetadataValue = string | string[];

type MetadataFieldDefinition = {
    field: TrackerFieldState;
    get(metadata: Metadata): MetadataValue;
    set(metadata: Metadata, value: MetadataValue): void;
};

type Descriptor = { id: string, label: string, size?: number };

function text(
    { id, label, size }: Descriptor,
    get: (metadata: Metadata) => string,
    set: (metadata: Metadata, value: string) => void
): MetadataFieldDefinition {
    return { field: { id, label, type: 'text', size }, get, set };
}

function multiline(
    { id, label }: Descriptor,
    get: (metadata: Metadata) => string,
    set: (metadata: Metadata, value: string) => void
): MetadataFieldDefinition {
    return { field: { id, label, type: 'multiline' }, get, set };
}

// Must be movie or TV otherwise TMDB has nothing to look up against
function categorySelect(
    { id, label, size }: Descriptor,
    get: (metadata: Metadata) => string,
    set: (metadata: Metadata, value: Category) => void
): MetadataFieldDefinition {
    return {
        field: {
            id,
            label,
            type: 'select',
            size,
            options: categories.map(category => ({ id: category, label: category })),
        },
        get,
        set: (metadata, value) => set(metadata, value as Category),
    };
}

function idText(
    descriptor: Descriptor,
    get: (metadata: Metadata) => number | null,
    set: (metadata: Metadata, value: number | null) => void
): MetadataFieldDefinition {
    return text(
        descriptor,
        metadata => {
            const value = get(metadata);
            return value === null ? '' : String(value);
        },
        (metadata, value) => {
            const parsed = parseInt(value, 10);
            set(metadata, Number.isNaN(parsed) ? null : parsed);
        }
    );
}

function list(
    { id, label, size }: Descriptor,
    get: (metadata: Metadata) => string[],
    set: (metadata: Metadata, value: string[]) => void
): MetadataFieldDefinition {
    return {
        field: { id, label, type: 'list', size },
        get: metadata => [...get(metadata)],
        set: (metadata, value: string[]) => set(
            metadata,
            value.map(item => item.trim()).filter(item => item !== '')
        ),
    };
}

const definitions: MetadataFieldDefinition[] = [

    // 0 to avoid sending null to the TMDB API
    text({ id: 'tmdbId', label: 'TMDB ID', size: 8 },
        metadata => metadata.tmdbId === 0 ? '' : String(metadata.tmdbId),
        (metadata, value) => { metadata.tmdbId = parseInt(value, 10) || 0; }),

    categorySelect({ id: 'category', label: 'Category', size: 8 },
        metadata => metadata.category,
        (metadata, value) => { metadata.category = value; }),

    text({ id: 'imdbId', label: 'IMDb ID', size: 11 },
        metadata => metadata.imdbId ?? '',
        (metadata, value) => { metadata.imdbId = value.trim() || null; }),

    idText({ id: 'tvdbId', label: 'TVDB ID', size: 8 },
        metadata => metadata.tvdbId,
        (metadata, value) => { metadata.tvdbId = value; }),

    text({ id: 'title', label: 'Title' },
        metadata => metadata.title,
        (metadata, value) => { metadata.title = value; }),

    text({ id: 'originalTitle', label: 'Original title' },
        metadata => metadata.originalTitle,
        (metadata, value) => { metadata.originalTitle = value; }),

    idText({ id: 'year', label: 'Year', size: 4 },
        metadata => metadata.year,
        (metadata, value) => { metadata.year = value; }),

    text({ id: 'originalLanguage', label: 'Original language', size: 6 },
        metadata => metadata.originalLanguage,
        (metadata, value) => { metadata.originalLanguage = value.trim(); }),

    text({ id: 'originCountry', label: 'Origin country', size: 6 },
        metadata => metadata.originCountry ?? '',
        (metadata, value) => { metadata.originCountry = value.trim() || null; }),

    idText({ id: 'malId', label: 'MAL ID', size: 8 },
        metadata => metadata.malId,
        (metadata, value) => { metadata.malId = value; }),

    list({ id: 'genres', label: 'Genres' },
        metadata => metadata.genres,
        (metadata, value) => { metadata.genres = value; }),

    list({ id: 'keywords', label: 'Keywords' },
        metadata => metadata.keywords,
        (metadata, value) => { metadata.keywords = value; }),

    multiline({ id: 'overview', label: 'Overview' },
        metadata => metadata.overview ?? '',
        (metadata, value) => { metadata.overview = value.trim() || undefined; }),

];

export const metadataTmdbIdField = 'tmdbId';
export const metadataCategoryField = 'category';

export const metadataFields: TrackerFieldState[] = definitions.map(definition => definition.field);

export const metadataLayout: FieldLayout = [
    ['tmdbId', 'category', 'imdbId', 'tvdbId'],
    ['title', 'title', 'originalTitle', 'originalTitle'],
    ['year', 'originalLanguage', 'originCountry', 'malId'],
    ['genres', 'genres', 'keywords', 'keywords'],
    ['overview', 'overview', 'overview', 'overview'],
];

export function emptyMetadata(): Metadata {
    return {
        category: 'movie',
        genres: [],
        imdbId: null,
        keywords: [],
        malId: null,
        originCountry: null,
        originalLanguage: '',
        originalTitle: '',
        posterUrl: null,
        title: '',
        tmdbId: 0,
        tvdbId: null,
        year: null,
    };
}

export function cloneMetadata(metadata: Metadata): Metadata {
    return { ...metadata, genres: [...metadata.genres], keywords: [...metadata.keywords] };
}

const MetadataNumberAsString = v.pipe(v.number(), v.transform(String));

/* Shape only, the setters below decide what's a valid value */
export const MetadataValuesSchema = v.strictObject(Object.fromEntries(
    definitions.map(({ field }) => [
        field.id,
        v.optional(field.type === 'list'
            ? v.array(v.string())
            : v.union([v.string(), MetadataNumberAsString])
        ),
    ])
));

export type MetadataValues = Record<string, MetadataValue | undefined>;

export function getMetadataValues(metadata: Metadata) {
    const output: Record<string, MetadataValue> = {};
    for (const definition of definitions) output[definition.field.id] = definition.get(metadata);
    return output;
}

export function setMetadataValue(metadata: Metadata, key: string, value: MetadataValue) {

    const definition = definitions.find(definition => definition.field.id === key);
    if (!definition) throw Error(`Couldn't find metadata field ${key}`);
    const { field } = definition;

    if (field.type === 'list') {
        if (!Array.isArray(value)) throw Error(`Couldn't set ${key}, expected a list of strings`);
        definition.set(metadata, value);
        return;
    }

    if (typeof value !== 'string') throw Error(`Couldn't set ${key}, expected a string, got a list`);

    if (field.type === 'select') {
        const ids = field.options.map(option => option.id);
        if (!ids.includes(value)) throw Error(`Couldn't set ${key}, must be one of: ${ids.join(', ')}`);
    }

    definition.set(metadata, value);

}
