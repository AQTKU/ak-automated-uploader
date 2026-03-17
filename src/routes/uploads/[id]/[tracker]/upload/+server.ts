import type { RequestHandler } from './$types';
import type Tracker from '$lib/server/tracker';
import why from '$lib/server/util/why';
import { ACCEPTED } from '$lib/server/util/empty-responses';
import { uploads } from '$lib/server/uploads';

export const PUT: RequestHandler = async ({ params, request }) => {

    const uploadId = parseInt(params.id);
    if (isNaN(uploadId)) return why(400, 'Upload ID must be a number');

    const upload = uploads.get(uploadId);
    if (!upload) { return why(404, `Couldn't find upload ${uploadId}`); }

    let tracker: Tracker;
    try { tracker = upload.getTrackerById(params.tracker); }
    catch { return why(404, `Couldn't find tracker ${params.tracker}`); }

    const formData = await request.formData();
    const entries = formData.entries();
    const data = Object.fromEntries(entries);

    try { tracker.setData(data); }
    catch (error) { return why(422, "Couldn't set tracker data", error); }

    // Fire and forget - this can be a very long process so we'll handle errors elsewhere
    await tracker.transformTags();
    tracker.submit();

    return ACCEPTED;

};