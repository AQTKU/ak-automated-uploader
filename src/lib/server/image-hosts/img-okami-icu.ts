import PQueue from 'p-queue';
import ImageHost from '../image-host';
import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import z from 'zod';
import errorString from '../util/error-string';
import { file } from 'bun';
import { basename } from 'node:path';

const UPLOAD_URL = 'https://img.okami.icu/api/v1/tools/upload';

const queue = new PQueue({ concurrency: 1, intervalCap: 20, interval: 60000, strict: true });

export const imgOkamiIcuFields: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'password',
    description: 'Generate an API key on the API tab on the <a href="https://img.okami.icu/settings">settings page</a>.',
    default: '',
}];

const schema = z.object({ apiKey: z.string() });

class ImgOkamiIcu extends ImageHost {

    apiKey: string = '';
    maxSize = 50 * 1024 * 1024;

    override async configure(settings: ImageHostSettings) {
        const data = schema.parse(settings);
        this.apiKey = data.apiKey;
    }

    async post(path: string): Promise<Image> {

        const formData = new FormData();
        formData.set('file', file(path), basename(path));
        formData.set('link_type', 'embed');

        console.log(this.apiKey);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
            },
            body: formData,
        });

        console.log(response.headers);

        if (!response.ok) {
            const error = await response.json();
            throw Error(error.detail ?? `Failed with error code ${response.status}`);
        }

        const data = await response.json();

        const schema = z.object({
            success: z.literal(true),
            share_url: z.httpUrl(),
            embed_url: z.httpUrl(),
            thumbnail_url: z.httpUrl(),
        });

        const validated = schema.parse(data);

        return {
            page: validated.share_url,
            image: validated.embed_url,
            thumbnail: validated.thumbnail_url,
        }

    }

    async upload(path: string) {
        return await queue.add(() => this.post(path));
    }

}

export const imgOkamiIcu = new ImgOkamiIcu();