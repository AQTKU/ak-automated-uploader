import { uploads } from '$lib/server/uploads';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return { uploads: uploads.toJSON() };
};