import settings from '$lib/server/settings';
import { error, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { addSession, checkSession } from '$lib/server/sessions';
import { timingSafeEqual } from 'node:crypto';

export const load = (async ({ cookies }) => {
    
    const session = cookies.get('akauSession');
    if (checkSession(session || '')) redirect(303, '/');

    const isFirstBoot = settings.isFirstBoot;
    const authToken = settings.all().authToken;
    if (!authToken) error(500, 'Configuration error');

    return {
        authToken: isFirstBoot ? authToken : null
    }

}) satisfies PageServerLoad;

export const actions = {

    default: async ({ request, cookies }) => {

        const data = await request.formData();
        const password = data.get('password') ?? '';
        if (typeof password !== 'string' || !settings.compareAgainstAuthToken(password)) {
            return { error: 'Invalid login token' };
        }

        const sessionId = addSession();
        cookies.set('akauSession', sessionId, {
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            secure: process.env.ORIGIN?.startsWith('https') ?? false,
        });

        settings.completeFirstBoot();

        redirect(303, '/');

    },

} satisfies Actions;