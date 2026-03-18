import PQueue from 'p-queue';
import z from 'zod';
import { normalize } from './util/normalize';

const queue = new PQueue({ concurrency: 1, strict: true, intervalCap: 1, interval: 1000 });

const ResultsSchema = z.object({
    pagination: z.object({
        has_next_page: z.boolean(),
    }),
    data: z.array(z.object({
        mal_id: z.number(),
        type: z.string(),
        titles: z.array(z.object({
            type: z.string(),
            title: z.string(),
        })),
        year: z.number().nullable(),
    })),
});

export async function getMalId(inputTitle: string, inputOriginalTitle: string, inputType: 'tv' | 'movie' | null, inputYear: number | null) {

    for (const query of [inputOriginalTitle, inputTitle]) {

        let nextPage: number | null = 1;
        const url = new URL('https://api.jikan.moe/v4/anime');
        url.searchParams.append('q', query);

        do {

            const response = await queue.add(async () => await fetch(url));
            const body = await response.json();
            const validated = ResultsSchema.parse(body);

            const filtered = validated.data.filter(({ type, year }) => {
                if (inputType === 'tv' && type === 'Movie') return false;
                if (inputType === 'movie' && type === 'TV') return false;
                if (type === 'Music') return false;
                if (inputYear && inputYear !== year) return false;
                return true;
            });

            for (const { mal_id, titles } of filtered) {
                for (const { type, title } of titles) {
                    switch (type) {

                        case 'Default':
                            if (normalize(inputTitle) === normalize(title)) return mal_id;
                            if (normalize(inputOriginalTitle) === normalize(title)) return mal_id;
                            break;

                        case 'Japanese':
                            if (inputTitle.normalize('NFKC').trim() === title.normalize('NFKC').trim()) return mal_id;
                            if (inputOriginalTitle.normalize('NFKC').trim() === title.normalize('NFKC').trim()) return mal_id;
                            break;

                        case 'English':
                            if (normalize(inputTitle) === normalize(title)) return mal_id;
                            break;

                    }
                }
            }

            nextPage = validated.pagination.has_next_page ? nextPage + 1 : null;
            url.searchParams.set('page', String(nextPage));

        } while (nextPage);

    }

    return null;

}