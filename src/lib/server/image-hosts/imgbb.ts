import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import { basename } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';

const FRONT_PAGE_URL = 'https://imgbb.com/';
const API_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const PAGE_UPLOAD_URL = 'https://imgbb.com/json';

export const imgBBSettings: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'password',
    description: 'Optional. Find your API key at the <a href="https://api.imgbb.com/">API page</a> after creating an account.',
    default: '',
}];

const queue = new PQueue({ concurrency: 1 });

class ImgBB extends ImageHost {

    apiKey: string = '';
    maxSize = 32 * 1000 * 1000;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
    }

    async getAuthToken() {

        const response = await fetch(FRONT_PAGE_URL);
        const body = await response.text();

        const matches = body.match(/PF\.obj\.config\.auth_token\s*=\s*(['"])(\w+?)\1/s)
        if (!matches || !matches[2]) throw Error("Couldn't find auth token on ImgBB front page");

        return matches[2];

    }

    async postToApi(image: string, thumbnail: boolean, signal: AbortSignal) {

        const bytes = await file(image).bytes();
        const base64 = bytes.toBase64();

        const body = new FormData();
        body.append('key', this.apiKey);
        body.append('image', base64);

        const response = await fetch(API_UPLOAD_URL, { method: 'POST', body, signal });
        const responseBody = await response.json();

        if (!response.ok || !responseBody.success) {
            const ErrorSchema = v.object({ error: v.object({ message: v.string() })});
            const error = v.safeParse(ErrorSchema, responseBody);
            if (error.success) throw Error(error.output.error.message);
            throw Error(responseBody.status_txt ?? response.statusText);
        }

        const Schema = v.object({
            data: v.object({
                url_viewer: v.pipe(v.string(), v.url()),
                image: v.object({ url: v.pipe(v.string(), v.url()) }),
                thumb: v.object({ url: v.pipe(v.string(), v.url()) }),
                medium: v.object({ url: v.pipe(v.string(), v.url()) }),
            }),
        });

        const validated = v.parse(Schema, responseBody);

        return {
            page: validated.data.url_viewer,
            image: validated.data.image.url,
            thumbnail: thumbnail ? validated.data.thumb.url : validated.data.medium.url,
        } satisfies Image;

    }

    async postToPage(image: string, thumbnail: boolean, signal: AbortSignal) {

        const authToken = await this.getAuthToken();

        const body = new FormData();
        body.set('source', file(image), basename(image));
        body.set('type', 'file');
        body.set('action', 'upload');
        body.set('timestamp', Temporal.Now.instant().epochMilliseconds.toString());
        body.set('auth_token', authToken);

        const response = await fetch(PAGE_UPLOAD_URL, { method: 'POST', body, signal });
        const responseBody = await response.json();

        if (!response.ok || !responseBody.success) {
            const ErrorSchema = v.object({ error: v.object({ message: v.string() })});
            const error = v.safeParse(ErrorSchema, responseBody);
            if (error.success) throw Error(error.output.error.message);
            throw Error(responseBody.status_txt ?? response.statusText);
        }

        const Schema = v.object({
            image: v.object({
                url_viewer: v.pipe(v.string(), v.url()),
                image: v.object({ url: v.pipe(v.string(), v.url()) }),
                thumb: v.object({ url: v.pipe(v.string(), v.url()) }),
                medium: v.object({ url: v.pipe(v.string(), v.url()) }),
            }),
        });

        const validated = v.parse(Schema, responseBody);

        return {
            page: validated.image.url_viewer,
            image: validated.image.image.url,
            thumbnail: thumbnail ? validated.image.thumb.url : validated.image.medium.url,
        } satisfies Image;

    }

    async upload(path: string, width: number | undefined, signal: AbortSignal) {
        if (this.apiKey) return await queue.add(() => this.postToApi(path, !width, signal));
        else return await queue.add(() => this.postToPage(path, !width, signal));
    }

}

export const imgBB = new ImgBB();