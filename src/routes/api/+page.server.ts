import settings from '$lib/server/settings';
import { error, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { addSession, checkSession } from '$lib/server/sessions';

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