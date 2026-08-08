import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { uploads } from '$lib/server/uploads';
import { releaseFields, releaseLayout } from '$lib/server/release-fields';

export const load: PageServerLoad = async ({ params }) => {
    const upload = uploads.get(parseInt(params.id));
    if (!upload) error(404);
    const { errors, id, release, releaseValues, releaseBaseline, releaseSettled, tmdbResults, tmdbSelected, files, torrentProgress, screenshots, trackerFields, trackerData, trackerStatus, trackerSearchResults, trackerActions } = upload.toJSON(undefined, false);
    return { errors, id, release, releaseValues, releaseBaseline, releaseSettled, releaseFields, releaseLayout, tmdbResults, tmdbSelected, files, torrentProgress, screenshots, trackerFields, trackerData, trackerStatus, trackerSearchResults, trackerActions };
};