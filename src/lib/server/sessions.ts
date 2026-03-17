import { Temporal } from '@js-temporal/polyfill';
import { randomBytes } from 'node:crypto';

const sessions = new Map<string, { expires: Temporal.Instant }>();
const A_WEEK = Temporal.Duration.from({ hours: 7 * 24 });

export function checkSession(id: string) {

    const session = sessions.get(id);
    if (!session) return false;

    if (Temporal.Instant.compare(session.expires, Temporal.Now.instant()) < 0) {
        sessions.delete(id);
        return false;
    }

    session.expires = Temporal.Now.instant().add(A_WEEK);
    return true;

}

export function addSession() {
    const id = randomBytes(32).toString('base64url');
    sessions.set(id, { expires: Temporal.Now.instant().add(A_WEEK) });
    return id;
}

export function removeSession(id: string) {
    sessions.delete(id);
}