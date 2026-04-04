import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses.js';
import why from '$lib/server/util/why.js';
import * as v from 'valibot';

export async function PATCH({ params, request }) {

    let tmdbId;

    try {
        const data = await request.json();
        tmdbId = v.parse(v.object({ tmdbId: v.number() }), data).tmdbId;
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        await upload.selectTmdbResult(tmdbId);
    } catch (error) {
        return why(500, "Couldn't select TMDB result", error);
    }

    return ACCEPTED;

}