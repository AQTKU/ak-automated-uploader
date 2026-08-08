import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses.js';
import why from '$lib/server/util/why.js';
import * as v from 'valibot';

export async function PATCH({ params, request }) {

    let set;

    try {
        const data = await request.json();
        const validated = v.parse(v.object({
            set: v.record(v.string(), v.union([v.string(), v.boolean()])),
        }), data);
        set = validated.set;
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        upload.setReleaseValues(set);
    } catch (error) {
        return why(422, `Couldn't set release data`, error);
    }

    return ACCEPTED;

}
