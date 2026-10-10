import type { RequestHandler } from './$types';
import normalizeApiInput from '#lib/server/util/normalize-api-input.js';
import applyApiInput, { ApiUploadSchema } from '#lib/server/util/apply-api-input.js';
import { whyByAcceptHeader } from '#lib/server/util/why.js';
import { noContent } from '#lib/server/util/empty-responses.js';
import { uploads } from '#lib/server/uploads.js';

export const POST: RequestHandler = async ({ request }) => {

    const why = whyByAcceptHeader(request);

    let input;

    try {
        input = await normalizeApiInput(request, ApiUploadSchema);
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    try {

        const uploadId = uploads.findOrCreate(input.contentPath, input.tracker);
        const upload = uploads.get(uploadId);
        if (!upload) return why(500, "Upload didn't get created for a mysterious reason");
        await upload.ready(request.signal);

        const tracker = await applyApiInput(upload, input);

        await tracker.submit(true);

    } catch (error) {
        return why(422, 'Failed to upload file', error);
    }

    return noContent();

};
