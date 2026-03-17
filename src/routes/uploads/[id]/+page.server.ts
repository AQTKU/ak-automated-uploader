import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { uploads } from '$lib/server/uploads';

export const load: PageServerLoad = async ({ params }) => {
    const upload = uploads.get(parseInt(params.id));
    if (!upload) error(404);
    const { errors, id, release, tmdbResults, tmdbSelected, files, torrentProgress, screenshots, trackerFields, trackerData, trackerStatus, trackerSearchResults, trackerActions } = upload.toJSON(undefined, false);
    return { errors, id, release, tmdbResults, tmdbSelected, files, torrentProgress, screenshots, trackerFields, trackerData, trackerStatus, trackerSearchResults, trackerActions };
};