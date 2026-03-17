import { uploads } from '$lib/server/uploads.js';
import { ACCEPTED } from '$lib/server/util/empty-responses.js';
import why from '$lib/server/util/why.js';
import z from 'zod';

export async function PATCH({ params, request }) {

    let path;
    let count;

    try {
        const data = await request.json();
        const validated = z.object({
            path: z.string(),
            count: z.number()
        }).parse(data);
        path = validated.path;
        count = validated.count;
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        upload.setScreenshotCount(path, count);
    } catch (error) {
        return why(422, `Couldn't set screenshot count`, error);
    }

    return ACCEPTED;

}