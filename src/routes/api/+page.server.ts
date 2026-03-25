import settings from '$lib/server/settings';
import { type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async () => {
    
    return {
        apiKey: settings.apiKey
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