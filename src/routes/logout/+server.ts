import { checkSession, removeSession } from '$lib/server/sessions';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {

    const isLoggedIn = checkSession(cookies.get('session') ?? '');
    if (isLoggedIn) removeSession(cookies.get('session') as string);
    cookies.delete('session', { path: '/' });
    redirect(303, '/login');

};