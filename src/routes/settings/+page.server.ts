import type { Actions, PageServerLoad } from './$types';
import errorString from '$lib/server/util/error-string';
import { redirect } from '@sveltejs/kit';
import { checkSession, removeSession } from '$lib/server/sessions';

interface Field {
    id: string;
    label: string;
    type?: 'path' | 'password' | 'multiline' | 'spacer' | 'imageHosts';
    description?: string;
}

interface FieldList {
    general: Field[];
}

const fields: FieldList = {

    general: [
        {
            id: 'tmdbApiKey',
            label: 'TMDB API key',
            type: 'password',
            description: 'You can generate a TMDB API key <a href="https://www.themoviedb.org/settings/api">here</a>. Use the longer one labelled API Read Access Token.',
        },
        {
            id: 'contentFolder',
            label: 'Content folder',
            type: 'path',
            description: 'The base folder where your files to upload live (optional).',
        },
    ],

};

function formToSettings(formData: FormData) {

    const data: any = {}

    for (const [key, value] of formData.entries()) {

        const match = key.match(/^(torrentClient|imageHosts|trackers)\[(\d+)\]\[(\w+)\]$/);
        const clientMatch = key.match(/^torrentClient\[(\w+)\]$/);

        if (match) {

            const category = match[1]!;
            const index = match[2]!;
            const field = match[3]!;

            const i = parseInt(index);

            if (!data[category]) data[category] = [];
            if (!data[category][i]) data[category][i] = {};

            if (field === 'imageHosts') {
                data[category][i][field] = value.split(',');
            } else {
                data[category][i][field] = value;
            }

        } else if (clientMatch) {

            const field = clientMatch[1]!;

            if (!data.torrentClient) data.torrentClient = {};
            data.torrentClient[field] = value;
            
        } else {
            data[key] = value;
        }

    }
    
    return data;

}

export const load: PageServerLoad = async ({ locals }) => {

    const settings = locals.settings.all();
    const availableImageHosts = locals.settings.getAvailableImageHostOptions();
    const selectedImageHosts = locals.settings.getSelectedImageHostOptions();
    const availableTorrentClients = locals.settings.getAvailableTorrentClientOptions();
    const selectedTorrentClients = locals.settings.getSelectedTorrentClientOptions();
    const availableTrackers = locals.settings.getAvailableTrackerOptions();
    const selectedTrackers = locals.settings.getSelectedTrackerOptions();

    return {
        settings,
        fields,
        availableImageHosts,
        selectedImageHosts,
        availableTorrentClients,
        selectedTorrentClients,
        availableTrackers,
        selectedTrackers,
    };

};

export const actions = {

    resetAuthToken: async({ request, locals, cookies }) => {

        const formData = await request.formData();
        const submittedToken = formData.get('authToken') ?? '';

        if (typeof submittedToken !== 'string') {
            return {
                success: false,
                why: 'Invalid token',
                from: 'resetAuthToken',
            };
        }

        if (!locals.settings.compareAgainstAuthToken(submittedToken)) {
            return {
                success: false,
                why: "Tokens don't match",
                from: 'resetAuthToken'
            }
        }

        locals.settings.unsetAuthToken();
        const isLoggedIn = checkSession(cookies.get('session') ?? '');
        if (isLoggedIn) removeSession(cookies.get('session') as string);
        cookies.delete('session', { path: '/' });
        redirect(303, '/login');

    },

    save: async ({ request, locals }) => {

        const formData = await request.formData();
        const data = formToSettings(formData);
        try {
            await locals.settings.set(data, undefined, true);
        } catch (error) {
            return {
                success: false,
                why: errorString('Settings not saved', error),
                from: 'save'
            }
        }

        return { success: true, from: 'save' };

    }
} satisfies Actions;