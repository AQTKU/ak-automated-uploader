import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses.js';
import why from '$lib/server/util/why.js';

export async function POST({ params }) {

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        await upload.searchTrackers();
    } catch (error) {
        return why(500, `Couldn't check the trackers for duplicates`, error);
    }

    return ACCEPTED;

}
