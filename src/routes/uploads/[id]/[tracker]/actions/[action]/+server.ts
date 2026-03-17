import type { RequestHandler } from './$types';
import type Tracker from '$lib/server/tracker';
import why from '$lib/server/util/why';
import { ACCEPTED, NO_CONTENT } from '$lib/server/util/empty-responses';
import { uploads } from '$lib/server/uploads';
import errorString from '$lib/server/util/error-string';

export const POST: RequestHandler = async ({ params, request }) => {

    const uploadId = parseInt(params.id);
    if (isNaN(uploadId)) return why(400, 'Upload ID must be a number');

    const upload = uploads.get(uploadId);
    if (!upload) { return why(404, `Couldn't find upload ${uploadId}`); }

    let tracker: Tracker;
    try { tracker = upload.getTrackerById(params.tracker); }
    catch { return why(404, `Couldn't find tracker ${params.tracker}`); }

    const actionId = parseInt(params.action);
    try {
        await tracker.performAction(actionId);
    } catch (error) {
        return why(500, errorString(`Problem performing action for ${tracker.name}`, error));
    }

    return NO_CONTENT;

};