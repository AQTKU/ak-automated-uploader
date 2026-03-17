import { redirect, type Handle } from '@sveltejs/kit';
import settings from '$lib/server/settings';
import { torrentClients } from '$lib/server/torrent-clients/index';
import { imageHosts } from '$lib/server/image-hosts/index';
import { trackers } from '$lib/server/trackers/index';
import { tmdb } from '$lib/server/tmdb';
import errorString from '$lib/server/util/error-string';
import { checkSession } from '$lib/server/sessions';
import { log } from '$lib/server/util/log';

log('Starting up');

for (const name in torrentClients) {
    if (torrentClients[name]) settings.addTorrentClientOption(name, torrentClients[name].fields);
}

for (const name in imageHosts) {
    if (imageHosts[name]) settings.addImageHostOption(name, imageHosts[name].fields);
}

for (const name in trackers) {
    if (trackers[name]) settings.addTrackerOption(name, trackers[name].fields);
}

try {

    await settings.load();

} catch (error) {
    log(errorString('Error during app start', error), 'crimson');
}

log('Ready', 'aquamarine');

export const handle: Handle = async ({ event, resolve }) => {

    event.locals.settings = settings;
    
    const timeZone = event.cookies.get('timeZone') || 'UTC';
    const locale = event.cookies.get('locale');
    event.locals.timeZone = timeZone;
    event.locals.locale = locale;

    const { pathname } = event.url;
    if (pathname === '/login') {
        return resolve(event);
    }

    const sessionId = event.cookies.get('session');
    if (!sessionId || !checkSession(sessionId)) {
        event.cookies.delete('session', { path: '/' });
        redirect(303, '/login');
    }

    event.cookies.set('session', sessionId, { path: '/', maxAge: 60 * 60 * 24 * 7 });

    return resolve(event);

};