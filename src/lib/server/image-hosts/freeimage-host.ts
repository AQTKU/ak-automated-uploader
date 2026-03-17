import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import z from 'zod';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import { log } from '../util/log';

const UPLOAD_URL = 'https://freeimage.host/api/1/upload';

export const freeimageHostFields: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'text',
    description: 'The Freeimage.host API key is freely accessible on their <a href="https://freeimage.host/page/api">API page</a>.',
    default: '6d207e02198a847aa98d0a2a901485a5',
}];

const schema = z.object({
    apiKey: z.string(),
});

const queue = new PQueue({ concurrency: 1 });

class FreeimageHost extends ImageHost {

    apiKey: string = '';
    maxSize = 64 * 1024 * 1024;

    override async configure(settings: ImageHostSettings) {
        const data = schema.parse(settings);
        this.apiKey = data.apiKey;
    }

    async post(image: string, thumb: boolean, signal?: AbortSignal): Promise<Image> {

        const arrayBuffer = await file(image).arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        const base64 = typedArray.toBase64();
        
        const formData = new FormData();
        formData.append('key', this.apiKey);
        formData.append('action', 'upload');
        formData.append('source', base64);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
            signal,
        });

        if (!response.ok) {
            throw Error(`Failed with status code ${response.status}`);
        }

        const data = await response.json();

        const schema = z.object({
            status_code: z.literal(200),
            image: z.object({
                url_viewer: z.httpUrl(),
                url: z.httpUrl(),
                medium: z.object({
                    url: z.httpUrl()
                }),
                thumb: z.object({
                    url: z.httpUrl()
                }),
            })
        });

        const validated = schema.parse(data);

        return {
            page: validated.image.url_viewer,
            image: validated.image.url,
            thumbnail: thumb ? validated.image.thumb.url : validated.image.medium.url,
        }

    }

    async upload(path: string, thumbnailWidth?: number, signal?: AbortSignal) {
        return await queue.add(() => this.post(path, !thumbnailWidth, signal));
    }

}

export const freeimageHost = new FreeimageHost();