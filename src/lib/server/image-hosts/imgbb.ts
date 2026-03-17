import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import z from 'zod';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';

const UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export const imgBBSettings: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'password',
    description: 'Find your API key at the <a href="https://api.imgbb.com/">API page</a> after creating an account.',
    default: '',
}];

const schema = z.object({
    apiKey: z.string(),
});

const queue = new PQueue({ concurrency: 1 });

class ImgBB extends ImageHost {

    apiKey: string = '';
    maxSize = 32 * 1000 * 1000;

    override async configure(settings: ImageHostSettings) {
        const data = schema.parse(settings);
        this.apiKey = data.apiKey;
    }

    async post(image: string, thumbnail: boolean, signal: AbortSignal): Promise<Image> {

        const typedArray = await file(image).bytes();
        const base64 = typedArray.toBase64();

        const formData = new FormData();
        formData.append('key', this.apiKey);
        formData.append('image', base64);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
            signal,
        });

        const body = await response.json();

        if (!response.ok || !body.success) {
            const ErrorSchema = z.object({ error: z.object({ message: z.string() })});
            const error = ErrorSchema.safeParse(body).data;
            if (error) throw Error(error.error.message);
            throw Error(body.status_txt ?? response.statusText);
        }

        const Schema = z.object({
            data: z.object({
                url_viewer: z.httpUrl(),
                image: z.object({ url: z.httpUrl() }),
                thumb: z.object({ url: z.httpUrl() }),
                medium: z.object({ url: z.httpUrl() }),
            }),
        });

        const validated = Schema.parse(body);

        return {
            page: validated.data.url_viewer,
            image: validated.data.image.url,
            thumbnail: thumbnail ? validated.data.thumb.url : validated.data.medium.url,
        }

    }

    async upload(path: string, width: number | undefined, signal: AbortSignal) {
        return await queue.add(() => this.post(path, !width, signal));
    }

}

export const imgBB = new ImgBB();