import z from 'zod';
import errorString from './util/error-string';
import PQueue from 'p-queue';
import { normalize } from './util/normalize';
import type { TmdbHydratedSearchResult } from '$lib/types';
import { Temporal } from '@js-temporal/polyfill';
import { log } from './util/log';

export type TmdbSettings = { apiKey: string };

const TmdbMovieSearchResultSchema = z.object({
    genre_ids: z.array(z.number()),
    id: z.number(),
    original_language: z.string(),
    original_title: z.string(),
    overview: z.string(),
    poster_path: z.string().nullable(),
    release_date: z.string(),
    title: z.string(),
});
export type TmdbMovieSearchResult = z.infer<typeof TmdbMovieSearchResultSchema>;
export type TmdbMovieSearchResults = {
    results: TmdbMovieSearchResult[],
    match: { name: string, result: TmdbMovieSearchResult } | null,
};

const TmdbTvSearchResultSchema = z.object({
    genre_ids: z.array(z.number()),
    id: z.number(),
    origin_country: z.array(z.string()),
    original_language: z.string(),
    original_name: z.string(),
    overview: z.string(),
    poster_path: z.string().nullable(),
    first_air_date: z.string(),
    name: z.string(),
});
export type TmdbTvSearchResult = z.infer<typeof TmdbTvSearchResultSchema>;
export type TmdbTvSearchResults = {
    results: TmdbTvSearchResult[],
    match: { name: string, result: TmdbTvSearchResult } | null,
};

export interface TmdbSearchResult {
    category: 'tv' | 'movie',
    genreIds: number[],
    tmdbId: number,
    originCountry: string | null,
    originalLanguage: string,
    originalTitle: string,
    overview: string,
    posterPath: string | null,
    year: number | null,
    title: string,
};
export type TmdbSearchResults = {
    results: TmdbSearchResult[],
    match: { name: string, result: TmdbSearchResult } | null,
}

type CacheMap<T> = Map<string, { data: T, expires: number }>;

class Tmdb {

    private apiKey: string = '';
    private authenticated = false;
    private cacheTTL = 60 * 1000;
    private hydrationCache = new Map<string, { data: any, expires: number }>();
    private imageConstants: { base_url: string, poster_sizes: string[] } | undefined = undefined;
    private movieGenres: Map<number, string> | undefined = undefined;
    private queryQueue = new PQueue({ concurrency: 1 });
    private searchCache = new Map<string, { data: any, expires: number }>();
    private tvGenres: Map<number, string> | undefined = undefined;

    private buildPossibleNamesFromResult(title: string, originalTitle: string, year: number | null, country: string | null) {

        const possibleNames = new Set<string>();

        const baseNames = [title];
        if (originalTitle) baseNames.push(originalTitle);
        const parts = [];
        if (year) parts.push(String(year));
        if (country) {
            if (country.toUpperCase() === 'GB') parts.push('UK');
            else parts.push(country);
        }

        for (const baseName of baseNames) {

            // Empty names might happen if there are no ASCII characters in the name
            if (normalize(baseName) === '') continue;

            possibleNames.add(baseName);

            for (const part of parts) {
                possibleNames.add(`${baseName} ${part}`)
            }

            if (parts.length === 2) {
                possibleNames.add(`${baseName} ${parts.join(' ')}`);
            }
        }
        
        return possibleNames;

    }

    private buildSearchOptions(title: string) {

        let queries: { title: string; year?: string }[] = [];

        queries.push({ title });

        if (title.includes('&')) {
            queries.push({ title: title.replace(/&/g, ' and ').replace(/ +/, ' ') });
        }

        if (/\band\b/i.test(title)) {
            queries.push({ title: title.replace(/\band\b/i, '&') });
        }

        if (/\s[A-Z]{2}$/i.test(title)) {
            queries.push({ title: title.replace(/\s+[A-Z]{2}$/i, '') });
        }

        const moreQueries: typeof queries = [];

        for (const query of queries) {

            const matches = query.title.match(/^(.+?)\s+([1-9][0-9]{3})$/);
            if (matches) {
                const [, title, year] = matches;
                moreQueries.push({ title: title!, year });
            }

        }

        queries.push(...moreQueries);

        return queries;

    }

    private cache<T>(cache: CacheMap<T>, key: string, data: T) {
        cache.set(key, { expires: Temporal.Now.instant().epochMilliseconds + this.cacheTTL, data });
    }

    async configure(settings: TmdbSettings) {
        this.apiKey = settings.apiKey;
        this.authenticated = false;
        try {
            await this.query('3/authentication', z.object({ success: z.literal(true) }));
            this.authenticated = true;
        } catch(error) {
            throw Error(errorString(`Failed to authenticate with TMDB`, error));
        }
        log('TMDB configured', 'aquamarine');
    }

    private getFromCache<T>(cache: CacheMap<T>, key: string): T | null {
        const entry = cache.get(key);
        if (entry && entry.expires > Temporal.Now.instant().epochMilliseconds) return entry.data;
        cache.delete(key);
        return null;
    }

    async getExternalIds(category: 'tv', id: number): Promise<{ imdb_id: string | null; tvdb_id: number | null }>;
    async getExternalIds(category: 'movie', id: number): Promise<{ imdb_id: string | null }>;
    async getExternalIds(category: 'tv' | 'movie', id: number) {

        let schema;

        if (category === 'tv') {

            schema = z.object({
                imdb_id: z.string().nullable(),
                tvdb_id: z.number().nullable(),
            });

        } else {

            schema = z.object({
                imdb_id: z.string().nullable(),
            });

        }

        return await this.query(`3/${category}/${id}/external_ids`, schema);

    }

    private async getGenres(category: 'movie' | 'tv') {

        if (category === 'tv' && this.tvGenres) return this.tvGenres;
        if (category === 'movie' && this.movieGenres) return this.movieGenres;

        const schema = z.object({
            genres: z.array(z.object({
                id: z.number(),
                name: z.string(),
            })),
        });

        const data = await this.query(`3/genre/${category}/list`, schema);

        const map = new Map<number, string>();
        for (const { id, name } of data.genres) {
            map.set(id, name);
        }

        if (category === 'tv') this.tvGenres = map;
        else this.movieGenres = map;

        return map;

    }

    private async getGenresFromIds(category: 'movie' | 'tv', inputIds: number[]) {

        const genreMap = await this.getGenres(category);

        const output: string[] = inputIds
            .map(inputId => genreMap.get(inputId))
            .filter(genre => genre !== undefined);

        return output;

    }

    private async getKeywords(category: 'movie' | 'tv', id: number) {

        if (category === 'tv') {

            const schema = z.object({
                results: z.array(z.object({
                    name: z.string(),
                })),
            });

            const data = await this.query(`3/${category}/${id}/keywords`, schema);
            return data.results.map(keyword => keyword.name);

        } else {

            const schema = z.object({
                keywords: z.array(z.object({
                    name: z.string(),
                })),
            });

            const data = await this.query(`3/${category}/${id}/keywords`, schema);
            return data.keywords.map(keyword => keyword.name);

        }

    }

    private async getImageConstants() {

        if (this.imageConstants) return this.imageConstants;

        const schema = z.object({
            images: z.object({
                'base_url': z.httpUrl(),
                'poster_sizes': z.array(z.string()),
            }),
        });

        const data = await this.query('3/configuration', schema);

        this.imageConstants = data.images;

        return this.imageConstants;

    }

    private getPosterSize(minWidth: number, posterSizes: string[]) {

        let size: number | null = null;

        for (const posterSize of posterSizes) {
            const matches = posterSize.match(/^w(\d+)$/i);
            if (matches) {
                const matchedSize = parseInt(matches[1]!);
                if (matchedSize >= minWidth && (!size || matchedSize <= size)) {
                    size = matchedSize;
                }
            }
        }

        return size ? `w${size}` : posterSizes.slice(-1)[0];

    }

    private async getPosterUrl(posterPath: string | null) {

        const imageConstants = await this.getImageConstants();

        if (posterPath === null) return null;

        const baseUrl = imageConstants.base_url;
        const posterSize = this.getPosterSize(500, imageConstants.poster_sizes);
        return baseUrl + posterSize + posterPath;

    }

    async hydrateResult(result: TmdbSearchResult): Promise<TmdbHydratedSearchResult> {

        if (!this.authenticated) throw Error('Not logged into TMDB');

        if (result.category === 'tv') {

            const cacheKey = `tv:${result.tmdbId}`;
            const cached = this.getFromCache<TmdbHydratedSearchResult>(this.hydrationCache, cacheKey);
            if (cached) return cached;

            const genres = await this.getGenresFromIds('tv', result.genreIds);
            const posterUrl = await this.getPosterUrl(result.posterPath);
            const externalIds = await this.getExternalIds('tv', result.tmdbId);
            const keywords = await this.getKeywords('tv', result.tmdbId);

            const output = {
                originCountry: result.originCountry,
                originalLanguage: result.originalLanguage,
                originalTitle: result.originalTitle,
                overview: result.overview,
                year: result.year,
                title: result.title,
                genres,
                posterUrl,
                tmdbId: result.tmdbId,
                tvdbId: externalIds.tvdb_id,
                imdbId: externalIds.imdb_id,
                keywords: keywords,
            };

            this.cache(this.hydrationCache, cacheKey, output);

            return output;

        } else {

            const cacheKey = `movie:${result.tmdbId}`;
            const cached = this.getFromCache<TmdbHydratedSearchResult>(this.hydrationCache, cacheKey);
            if (cached) return cached;

            const genres = await this.getGenresFromIds('movie', result.genreIds);
            const posterUrl = await this.getPosterUrl(result.posterPath);
            const externalIds = await this.getExternalIds('movie', result.tmdbId);
            const keywords = await this.getKeywords('movie', result.tmdbId);

            const output = {
                originCountry: result.originCountry,
                originalLanguage: result.originalLanguage,
                originalTitle: result.originalTitle,
                overview: result.overview,
                year: result.year,
                title: result.title,
                genres,
                posterUrl,
                tmdbId: result.tmdbId,
                tvdbId: null,
                imdbId: externalIds.imdb_id,
                keywords: keywords,
            };

            this.cache(this.hydrationCache, cacheKey, output);

            return output;

        }


    }

    private matchResult(title: string, results: TmdbSearchResult[]): { result: TmdbSearchResult, name: string } | null {

        for (const result of results) {

            let possibleNames: Set<string>;

            possibleNames = this.buildPossibleNamesFromResult(
                result.title,
                result.originalTitle,
                result.year,
                result.originCountry
            );

            for (const possibleName of possibleNames) {
                if (normalize(title) === normalize(possibleName)) {
                    return { result, name: possibleName };
                }
            }

        }

        return null;

    }

    private normalizeResults(results: Array<TmdbTvSearchResult | TmdbMovieSearchResult>): TmdbSearchResult[] {

        const output: TmdbSearchResult[] = [];
        const ids: number[] = [];

        for (const result of results) {

            if (ids.includes(result.id)) continue;
            ids.push(result.id);

            if ('name' in result) { // TV

                output.push({
                    category: 'tv',
                    genreIds: result.genre_ids,
                    tmdbId: result.id,
                    originCountry: result.origin_country[0] || null,
                    originalLanguage: result.original_language,
                    originalTitle: result.original_name,
                    overview: result.overview,
                    posterPath: result.poster_path,
                    year: result.first_air_date ? Temporal.PlainDate.from(result.first_air_date).year : null,
                    title: result.name
                });

            } else { // Movie

                output.push({
                    category: 'movie',
                    genreIds: result.genre_ids,
                    tmdbId: result.id,
                    originCountry: null,
                    originalLanguage: result.original_language,
                    originalTitle: result.original_title,
                    overview: result.overview,
                    posterPath: result.poster_path,
                    year: result.release_date ? Temporal.PlainDate.from(result.release_date).year : null,
                    title: result.title
                });

            }

        }

        return output;

    }

    private async query<T extends z.ZodType>(
        endpoint: string,
        schema: T,
        params: Record<string, string> = {}
    ): Promise<z.infer<T>> {

        return this.queryQueue.add(async () => {

            try {

                const url = new URL(`https://api.themoviedb.org/${endpoint}`);
                url.search = String(new URLSearchParams(params));

                const headers = {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json;charset=utf-8',
                };

                const response = await fetch(url, { headers });
                const data = await response.json();

                if (!response.ok) {
                    throw Error('status_message' in data ? data.status_message : response.statusText);
                }

                return schema.parse(data);

            } catch (error) {
                throw Error(errorString(`Couldn't fetch ${endpoint} from the TMDB API`, error));
            }

        });

    }

    async searchMovie(title: string, year: number | null = null): Promise<TmdbSearchResults> {

        if (!this.authenticated) throw Error('Not logged into TMDB');

        if (title === '') return { results: [], match: null };

        const schema = z.object({
            page: z.number(),
            total_pages: z.number(),
            results: z.array(TmdbMovieSearchResultSchema),
        });

        const results: TmdbMovieSearchResult[] = [];

        const cacheKey = `movie:${title}`;
        const cached = this.getFromCache<TmdbSearchResults>(this.searchCache, cacheKey);
        if (cached) return cached;

        const queries = this.buildSearchOptions(title);

        for (const query of queries) {

            let page = 1;
            type SearchParams = { query: string, year?: string, page?: string };
            const params: SearchParams = { query: query.title };
            if (query.year) params.year = query.year;
            if (year) params.year = String(year);

            let data: z.infer<typeof schema>;
            do {
                params.page = String(page);
                data = await this.query('3/search/movie', schema, params);
                results.push(...data.results);
                page++;
            } while (data.total_pages >= page);

        }

        const normalized = this.normalizeResults(results);

        const match = this.matchResult(title, normalized);

        const result = { results: normalized, match };

        this.cache<TmdbSearchResults>(this.searchCache, cacheKey, result);

        return result;

    }

    async searchTv(title: string): Promise<TmdbSearchResults> {

        if (!this.authenticated) throw Error('Not logged into TMDB');

        if (title === '') return { results: [], match: null };

        const schema = z.object({
            page: z.number(),
            total_pages: z.number(),
            results: z.array(TmdbTvSearchResultSchema),
        });
        
        const results: TmdbTvSearchResult[] = [];

        const cacheKey = `tv:${title}`;
        const cached = this.getFromCache<TmdbSearchResults>(this.searchCache, cacheKey);
        if (cached) return cached;

        const queries = this.buildSearchOptions(title);

        for (const query of queries) {

            let page = 1;
            type SearchParams = { query: string, year?: string, page?: string };
            const params: SearchParams = { query: query.title };
            if (query.year) params.year = query.year;

            let data: z.infer<typeof schema>;
            do {
                params.page = String(page);
                data = await this.query('3/search/tv', schema, params);
                results.push(...data.results);
                page++;
            } while (data.total_pages >= page);

        }

        const normalized = this.normalizeResults(results);

        const match = this.matchResult(title, normalized);

        const result = { results: normalized, match };

        this.cache<TmdbSearchResults>(this.searchCache, cacheKey, result);

        return result;

    }

}

export const tmdb = new Tmdb();