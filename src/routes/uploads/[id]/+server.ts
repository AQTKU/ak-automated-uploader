import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses';
import why from '$lib/server/util/why.js';

export async function DELETE({ params }) {

    const { id } = params;

    try {
        uploads.delete(parseInt(id));
    } catch (error) {
        return why(404, "Couldn't delete upload", error);
    }

    return ACCEPTED;

}