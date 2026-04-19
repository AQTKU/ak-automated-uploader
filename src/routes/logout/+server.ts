import { checkSession, removeSession } from '$lib/server/sessions';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {

    const isLoggedIn = checkSession(cookies.get('akauSession') ?? '');
    if (isLoggedIn) removeSession(cookies.get('akauSession') as string);
    cookies.delete('akauSession', { path: '/' });
    redirect(303, '/login');

};