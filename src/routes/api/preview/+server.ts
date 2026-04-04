import type { RequestHandler } from './$types';
import normalizeApiInput from '$lib/server/util/normalize-api-input';
import { whyByAcceptHeader } from '$lib/server/util/why';
import { NO_CONTENT } from '$lib/server/util/empty-responses';
import { uploads } from '$lib/server/uploads';
import { ApiUploadSchema } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {

    const why = whyByAcceptHeader(request);

    let input;

    try {
        input = await normalizeApiInput(request, ApiUploadSchema);
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    try {

        const uploadId = uploads.create(input.contentPath);
        const upload = uploads.get(uploadId);
        if (!upload) return why(500, "Upload didn't get created for a mysterious reason");
        await upload.readyToEdit;

        const tracker = upload.getTrackerByName(input.tracker);

        const entries = Object.entries(input.set);
        for (const [key, value] of entries) {
            tracker.set(key, value, false);
        }
        tracker.emitDataChanged();

        await tracker.transformTags();

    } catch (error) {
        return why(422, 'Failed to upload file', error);
    }

    return NO_CONTENT;

};