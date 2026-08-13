import PQueue from 'p-queue';
import ImageHost from '../image-host';
import resizeImage from '../util/resize-image';
import { file } from 'bun';
import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';

const queue = new PQueue({ concurrency: 1 });

export const fields: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'password',
    description: 'Generate an API key at your <a href="https://lostimg.cc/settings">settings page</a>.',
    default: '',
}];

class LostImg extends ImageHost {

    apiKey: string = '';
    maxSize = Infinity;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
    }

    async upload(path: string, thumbnailWidth = 350, signal?: AbortSignal) {
        const image = file(path);
        const thumb = await resizeImage(path, thumbnailWidth);
        return await queue.add(() => this.post(image, thumb, signal));
    }

    async post(image: Blob, thumbnail: Blob, signal?: AbortSignal) {

        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
        };

        const body = new FormData();
        body.append('file[]', thumbnail, 'thumb.png');
        body.append('file[]', image);

        const response = await fetch(
            'https://lostimg.cc/api/v1/images',
            { method: 'POST', headers, body, signal }
        );

        if (!response.ok) {
            let data: any = {};
            try { data = await response.json(); } catch { }
            throw Error(data.error ? String(data.error) : response.statusText);
        }

        const data = await response.json();

        const Schema = v.object({
            urls: v.pipe(
                v.array(v.pipe(v.string(), v.url())),
                v.length(2),
            ),
        });
        const validated = v.parse(Schema, data);
        const [thumbnailUrl, imageUrl] = validated.urls;

        return {
            page: imageUrl!,
            image: imageUrl!,
            thumbnail: thumbnailUrl!,
        } satisfies Image;

    }

}

export const lostImg = new LostImg();