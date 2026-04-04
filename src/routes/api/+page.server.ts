import settings from '$lib/server/settings';
import { type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trackers } from '$lib/server/trackers/index';

export const load = (async () => {
    
    return {
        apiKey: settings.apiKey,
        trackers: Object.entries(trackers).map(tracker => ({ name: tracker[0], fields: tracker[1].fields })),
    }

}) satisfies PageServerLoad;

export const actions = {

    generate: async () => {
        await settings.generateApiKey();
    },

    rescind: async () => {
        await settings.rescindApiKey();
    },

} satisfies Actions;