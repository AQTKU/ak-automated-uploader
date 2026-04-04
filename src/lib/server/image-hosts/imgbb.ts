import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';
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

const queue = new PQueue({ concurrency: 1 });

class ImgBB extends ImageHost {

    apiKey: string = '';
    maxSize = 32 * 1000 * 1000;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
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
            const ErrorSchema = v.object({ error: v.object({ message: v.string() })});
            const error = v.safeParse(ErrorSchema, body);
            if (error.success) throw Error(error.output.error.message);
            throw Error(body.status_txt ?? response.statusText);
        }

        const Schema = v.object({
            data: v.object({
                url_viewer: v.pipe(v.string(), v.url()),
                image: v.object({ url: v.pipe(v.string(), v.url()) }),
                thumb: v.object({ url: v.pipe(v.string(), v.url()) }),
                medium: v.object({ url: v.pipe(v.string(), v.url()) }),
            })
        })

        const validated = v.parse(Schema, body);

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