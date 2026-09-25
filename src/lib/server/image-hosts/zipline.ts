import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import { setTimeout as sleep } from 'node:timers/promises';
import resizeImage from '../util/resize-image';
import { basename } from 'node:path';
import { log } from '../util/log';

export const ziplineFields: SettingsField[] = [{
    id: 'server',
    label: 'Server URL',
    type: 'text',
    default: '',
}, {
    id: 'apiKey',
    label: 'API token',
    type: 'password',
    default: '',
}];

const queue = new PQueue({ concurrency: 1 });
const MAX_ATTEMPTS = 5;
const MAX_WAIT = 60;

class Zipline extends ImageHost {

    apiKey: string = '';
    server: string = '';
    maxSize = Infinity;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
        this.server = settings.server ?? '';
    }

    async post(image: Blob, filename: string, signal: AbortSignal): Promise<string> {

        const url = new URL('/api/upload', this.server);
        let waited = 0;
        let response: Response;
        let body: any;

        for (let attempt = 1; ; attempt++) {

            const formData = new FormData();
            formData.append('file', image, filename);

            response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: this.apiKey },
                body: formData,
                signal,
            });

            body = await response.json();

            if (response.status !== 429) break;

            const match = body.error?.match(/retry in (\d+) seconds/i);
            const delay = match ? Number(match[1]) : undefined;

            if (delay === undefined) throw Error('Rate limited');
            if (attempt >= MAX_ATTEMPTS || waited + delay > MAX_WAIT) throw Error(`Rate limited, gave up after ${attempt} attempts`);

            log(`Rate limited, retrying in ${delay}s`);
            await sleep(delay * 1000, undefined, { signal });
            waited += delay;

        }

        if (!response.ok) {
            throw Error(body.error ?? response.statusText);
        }

        const Schema = v.object({
            files: v.pipe(
                v.array(v.object({ url: v.pipe(v.string(), v.url()) })),
                v.length(1),
            ),
        });

        return v.parse(Schema, body).files[0]!.url;
    }

    async upload(path: string, width = 350, signal: AbortSignal) {

        const imageUrl = await queue.add(() => this.post(file(path), basename(path), signal), { signal });
        const thumb = await resizeImage(path, width);
        const thumbUrl = await queue.add(() => this.post(thumb, basename(path, '.png') + '-thumb.png', signal), { signal });

        return {
            image: imageUrl,
            page: imageUrl,
            thumbnail: thumbUrl,
        } satisfies Image;
    }
}

export const zipline = new Zipline();