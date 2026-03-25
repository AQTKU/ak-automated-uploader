import { Temporal } from '@js-temporal/polyfill';
import { color } from 'bun';
import { EOL } from 'node:os';

export function log(message: string, _color: 'tomato' | 'khaki' | 'aquamarine' | 'lightgrey' = 'lightgrey') {

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = Temporal.Now.instant().toZonedDateTimeISO(timeZone);
    const time = now.toLocaleString(undefined, { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' })

    const prefix = color('grey', 'ansi-16m') + time + color('cornflowerblue', 'ansi-16m') + ' [ak-automated-uploader] ';
    const suffix = '\x1B[0m';

    switch (_color) {
        case 'tomato': case 'khaki':
            process.stderr.write(prefix + color(_color, 'ansi-16m') + message + suffix + EOL);
            break;
        case 'aquamarine': default:
            process.stdout.write(prefix + color(_color, 'ansi-16m') + message + suffix + EOL);
            break;
    }
}