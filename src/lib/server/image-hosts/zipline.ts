import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import sharp from 'sharp';
import { basename } from 'node:path';

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

class Zipline extends ImageHost {

    apiKey: string = '';
    server: string = '';
    maxSize = Infinity;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
        this.server = settings.server ?? '';
    }

    async makeThumb(fullSizePath: string, width: number): Promise<Blob> {
        const thumb = sharp(fullSizePath).resize(width).png();
        const buffer = await thumb.toBuffer();
        const typedArray = new Uint8Array(buffer);
        return new Blob([typedArray], { type: 'image/png' });
    }

    async post(image: Blob, filename: string, signal: AbortSignal): Promise<string> {

        const formData = new FormData();
        formData.append('file', image, filename);

        const url = new URL('/api/upload', this.server);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: this.apiKey,
            },
            body: formData,
            signal,
        });

        const body = await response.json();

        if (!response.ok) {
            throw Error(body.error ?? response.statusText);
        }

        const Schema = v.object({
            files: v.pipe(
                v.array(
                    v.object({
                        url: v.pipe(v.string(), v.url())
                    })
                ), v.length(1)
            ),
        });

        const validated = v.parse(Schema, body);

        return validated.files[0]!.url;
    }

    async upload(path: string, width = 350, signal: AbortSignal) {

        const imageUrl = await queue.add(() => this.post(file(path), basename(path), signal), { signal });
        const thumb = await this.makeThumb(path, width);
        const thumbUrl = await queue.add(() => this.post(thumb, basename(path, '.png') + '-thumb.png', signal), { signal });

        return {
            image: imageUrl,
            page: imageUrl,
            thumbnail: thumbUrl,
        } satisfies Image;
    }
}

export const zipline = new Zipline();