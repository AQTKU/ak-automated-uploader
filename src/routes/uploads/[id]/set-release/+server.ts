import { uploads } from '$lib/server/uploads.js';
import { accepted } from '$lib/server/util/empty-responses';
import normalizeApiInput from '$lib/server/util/normalize-api-input';
import why from '$lib/server/util/why.js';
import * as v from 'valibot';

const SetReleaseSchema = v.object({
    set: v.record(v.string(), v.union([v.string(), v.boolean(), v.file()])),
});

export async function PATCH({ params, request }) {

    let set;

    try {
        set = (await normalizeApiInput(request, SetReleaseSchema)).set;
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

    return accepted();

}
