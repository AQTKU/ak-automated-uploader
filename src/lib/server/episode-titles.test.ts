import { describe, expect, test } from 'bun:test';
import Release from './release';
import { findSeasonOrEpisodeTitle } from './episode-titles';
import type { TmdbEpisode, TmdbSeason } from './tmdb';

type Show = Record<number, { name: string, episodes?: string[] | Record<number, string> }>;

function find(fileName: string, show: Show) {

    const seasons: TmdbSeason[] = Object.entries(show)
        .map(([seasonNumber, season]) => ({ seasonNumber: parseInt(seasonNumber, 10), name: season.name }));

    async function getEpisodes(seasonNumber: number): Promise<TmdbEpisode[]> {
        const episodes = show[seasonNumber]?.episodes ?? [];
        const entries = Array.isArray(episodes)
            ? episodes.map((name, index) => [index + 1, name] as const)
            : Object.entries(episodes).map(([episodeNumber, name]) => [parseInt(episodeNumber, 10), name] as const);
        return entries.map(([episodeNumber, name]) => ({ episodeNumber, name }));
    }

    return findSeasonOrEpisodeTitle(new Release(fileName), seasons, getEpisodes);

}

const tail = '1080p.WEB-DL.AAC2.0.H.264-GRP.mkv';

describe('episode titles', () => {

    const show: Show = { 12: { name: 'Season 12', episodes: { 10: "I'm Questioning Everything" } } };

    test('takes the TMDB spelling of a matching title', async () => {
        expect(await find(`90.Day.Fiance.S12E10.Im.Questioning.Everything.${tail}`, show))
            .toBe("I'm Questioning Everything");
    });

    test('keeps whatever follows a match at the start of the title', async () => {
        expect(await find(`90.Day.Fiance.S12E10.Im.Questioning.Everything.NORDiC.${tail}`, show))
            .toBe("I'm Questioning Everything NORDiC");
    });

    test('only matches on a word boundary', async () => {
        const show: Show = { 1: { name: 'Season 1', episodes: ['The Begin'] } };
        expect(await find(`Show.S01E01.The.Beginning.${tail}`, show)).toBeNull();
    });

    test("doesn't match a title that only partly appears in the filename", async () => {
        expect(await find(`90.Day.Fiance.S12E10.Im.Questioning.${tail}`, show)).toBeNull();
    });

    test('ignores placeholder titles', async () => {
        const show: Show = { 1: { name: 'Season 1', episodes: ['Episode 1', 'TBA'] } };
        expect(await find(`Show.S01E01.Episode.1.${tail}`, show)).toBeNull();
        expect(await find(`Show.S01E02.TBA.${tail}`, show)).toBeNull();
    });

    test('does nothing without a title in the filename', async () => {
        expect(await find(`90.Day.Fiance.S12E10.${tail}`, show)).toBeNull();
    });

    test('does nothing when the episode is missing from TMDB', async () => {
        expect(await find(`90.Day.Fiance.S12E11.Im.Questioning.Everything.${tail}`, show)).toBeNull();
    });

    test('tries a season whose name has the number when TMDB numbers it differently', async () => {
        const show: Show = {
            4: { name: 'All Stars', episodes: ['Something Else'] },
            5: { name: 'Season 4', episodes: ['Le Grand Retour'] },
        };
        expect(await find(`Drag.Race.France.S04E01.Le.Grand.Retour.${tail}`, show)).toBe('Le Grand Retour');
    });

    test('prefers the season TMDB numbers the same way', async () => {
        const show: Show = {
            4: { name: 'Season 3', episodes: ['Premiere'] },
            5: { name: 'Season 4', episodes: ['Premiere!'] },
        };
        expect(await find(`Show.S04E01.Premiere.${tail}`, show)).toBe('Premiere');
    });

});

describe('multi-episode titles', () => {

    const show: Show = { 1: { name: 'Season 1', episodes: ['Part One', 'Part Two', 'Part Three', 'And Then'] } };

    test.each([
        'Part.One.-.Part.Two',
        'Part.One-Part.Two',
        'Part.One.Part.Two',
        'Part.One.and.Part.Two',
    ])('matches %s', async title => {
        expect(await find(`Show.S01E01E02.${title}.${tail}`, show)).toBe('Part One / Part Two');
    });

    test('matches a range of episodes', async () => {
        expect(await find(`Show.S01E01-03.Part.One.Part.Two.Part.Three.${tail}`, show))
            .toBe('Part One / Part Two / Part Three');
    });

    test.each([
        'Part.One.and.Part.Two.and.Part.Three',
        'Part.One.Part.Two.and.Part.Three',
    ])('matches %s', async title => {
        expect(await find(`Show.S01E01-03.${title}.${tail}`, show)).toBe('Part One / Part Two / Part Three');
    });

    test('lets a title start with "and"', async () => {
        expect(await find(`Show.S01E03E04.Part.Three.And.Then.${tail}`, show)).toBe('Part Three / And Then');
    });

    test('needs every episode to match', async () => {
        expect(await find(`Show.S01E01E02.Part.One.${tail}`, show)).toBeNull();
    });

});

describe('season titles', () => {

    const babylon = `Babylon.5.S04.No.Surrender.No.Retreat.${tail}`;

    test('matches a season pack against the season name', async () => {
        const show: Show = { 4: { name: 'No Surrender, No Retreat' } };
        expect(await find(babylon, show)).toBe('No Surrender, No Retreat');
    });

    test.each([
        'Season 4 - No Surrender, No Retreat',
        'Season 4: No Surrender, No Retreat',
    ])('strips the season number from %s', async name => {
        expect(await find(babylon, { 4: { name } })).toBe('No Surrender, No Retreat');
    });

    test('uses the number in the name when TMDB numbers the season differently', async () => {
        const show: Show = { 5: { name: 'Season 4 - No Surrender, No Retreat' } };
        expect(await find(babylon, show)).toBe('No Surrender, No Retreat');
    });

    test('ignores a season name that is only its number', async () => {
        expect(await find(`Show.S04.Season.4.${tail}`, { 4: { name: 'Season 4' } })).toBeNull();
    });

});

describe('special titles', () => {

    const show: Show = {
        0: { name: 'Specials', episodes: { 1: 'Meet the Queens', 12: 'Meet the Queens of Season 6' } },
        6: { name: 'Season 6', episodes: ['Meet the Queens of Season 6'] },
    };

    test('matches the whole title against any special, whatever its number', async () => {
        expect(await find(`Drag.Race.S00E05.Meet.the.Queens.of.Season.6.${tail}`, show))
            .toBe('Meet the Queens of Season 6');
    });

    test("doesn't match only the start of a special's title", async () => {
        const show: Show = { 0: { name: 'Specials', episodes: ['Meet the Queens'] } };
        expect(await find(`Drag.Race.S00E05.Meet.the.Queens.of.Season.6.${tail}`, show)).toBeNull();
    });

    test('looks in the specials for an episode zero', async () => {
        expect(await find(`Drag.Race.S06E00.Meet.the.Queens.of.Season.6.${tail}`, show))
            .toBe('Meet the Queens of Season 6');
    });

});
