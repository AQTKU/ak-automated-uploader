import type Release from './release';
import type { TmdbEpisode, TmdbSeason } from './tmdb';
import { normalize } from './util/normalize';

type ParsedRelease = Pick<Release, 'episodes' | 'isSeasonPack' | 'isSpecial' | 'season' | 'seasonOrEpisodeTitle'>;

function isPlaceholder(name: string) {
    const normalized = normalize(name);
    return normalized === '' || normalized === 'tba' || /^episode \d+$/.test(normalized);
}

function isSpecials(season: TmdbSeason) {
    return season.seasonNumber === 0 || normalize(season.name) === 'specials';
}

/* TMDB's season numbers don't always follow the names, so a season called "Season 4"
   is worth trying for S04 even when TMDB numbers it 5 */
function candidateSeasons(seasons: TmdbSeason[], season: number) {
    const named = (candidate: TmdbSeason) => [...candidate.name.matchAll(/\b\d+\b/g)]
        .some(match => parseInt(match[0], 10) === season);
    return [
        ...seasons.filter(candidate => candidate.seasonNumber === season),
        ...seasons.filter(candidate => candidate.seasonNumber !== season && !isSpecials(candidate) && named(candidate)),
    ];
}

function seasonTitleOf(season: TmdbSeason) {
    const name = season.name.replace(/^(?:season|series)\s*\d+\s*[-–—:]?\s*/i, '').trim();
    return isPlaceholder(name) ? null : name;
}

/* Multi-episode releases put their titles in a row, sometimes with "and" between each one
   or only before the last */
function joinNames(names: string[]) {
    const joined = [names.join(' '), names.join(' and ')];
    if (names.length >= 3) joined.push(`${names.slice(0, -1).join(' ')} and ${names[names.length - 1]}`);
    return joined.map(normalize);
}

/* Whatever follows the match is kept, since it may be a tag the release parser didn't know */
function tailAfter(title: string, normalizedMatch: string) {
    const words = title.split(' ');
    for (let count = 1; count <= words.length; count++) {
        if (normalize(words.slice(0, count).join(' ')) === normalizedMatch) return words.slice(count).join(' ');
    }
    return '';
}

function matchNames(title: string, names: string[]) {

    const normalizedTitle = normalize(title);
    const match = joinNames(names)
        .find(joined => normalizedTitle === joined || normalizedTitle.startsWith(`${joined} `));
    if (match === undefined) return null;

    return [names.join(' / '), tailAfter(title, match)].filter(Boolean).join(' ');

}

function matchSpecial(title: string, episodes: TmdbEpisode[]) {
    const normalized = normalize(title);
    const match = episodes.find(episode => !isPlaceholder(episode.name) && normalize(episode.name) === normalized);
    return match ? match.name.trim() : null;
}

export async function findSeasonOrEpisodeTitle(
    release: ParsedRelease,
    seasons: TmdbSeason[],
    getEpisodes: (seasonNumber: number) => Promise<TmdbEpisode[]>,
): Promise<string | null> {

    const title = release.seasonOrEpisodeTitle;
    if (!title) return null;

    if (release.isSpecial) {
        for (const season of seasons.filter(isSpecials)) {
            const match = matchSpecial(title, await getEpisodes(season.seasonNumber));
            if (match) return match;
        }
        return null;
    }

    if (release.season === null) return null;
    const candidates = candidateSeasons(seasons, release.season);

    if (release.isSeasonPack) {
        for (const season of candidates) {
            const name = seasonTitleOf(season);
            const match = name ? matchNames(title, [name]) : null;
            if (match) return match;
        }
        return null;
    }

    const numbers = release.episodes;
    if (numbers.length === 0) return null;

    for (const season of candidates) {
        const episodes = await getEpisodes(season.seasonNumber);
        const names = numbers.map(number => episodes.find(episode => episode.episodeNumber === number)?.name.trim());
        if (names.some(name => name === undefined || isPlaceholder(name))) continue;
        const match = matchNames(title, names as string[]);
        if (match) return match;
    }

    return null;

}
