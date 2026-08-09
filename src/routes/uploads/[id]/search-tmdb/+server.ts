import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses.js';
import why from '$lib/server/util/why.js';
import { categories } from '$lib/server/release-tables.js';
import * as v from 'valibot';

export async function POST({ params, request }) {

    let search;

    try {
        const data = await request.json();
        search = v.parse(v.object({
            query: v.pipe(v.string(), v.trim(), v.nonEmpty('Enter something to search for')),
            category: v.picklist(categories),
            year: v.nullable(v.number()),
        }), data);
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        await upload.searchTmdb(search.query, search.category, search.year);
    } catch (error) {
        return why(502, `Couldn't search TMDB`, error);
    }

    return ACCEPTED;

}
