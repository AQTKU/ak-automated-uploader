import PQueue from 'p-queue';
import ImageHost from '../image-host';
import type { Image } from '$lib/types';
import z from 'zod';
import { file } from 'bun';
import { load } from 'cheerio';

const queue = new PQueue({ concurrency: 1 })

class PiXhost extends ImageHost {

    maxSize = 10 * 1024 * 1024;

    async upload(path: string, thumbnailWidth = 350, signal?: AbortSignal) {
        return await queue.add(() => this.post(path, thumbnailWidth, signal));
    }

    private async getDirectUrl(pageUrl: string, signal?: AbortSignal) {

        const response = await fetch(pageUrl, { signal });
        const source = await response.text();

        const page = load(source);
        const url = page('#image').attr('src');
        return z.httpUrl().parse(url);

    }

    async post(path: string, thumbnailWidth: number, signal?: AbortSignal) {

        const formData = new FormData();
        formData.append('img', file(path));
        formData.append('content_type', '0'); // 1 for NSFW, dunno what it actually does, maybe displays NSFW ads
        formData.append('max_th_size', thumbnailWidth.toString());

        const response = await fetch('https://api.pixhost.to/images', {
            method: 'POST',
            headers: { accept: 'application/json' },
            body: formData,
            signal,
        });

        if (!response.ok) throw Error(response.statusText);

        const body = await response.json();

        const validated = z.object({
            show_url: z.httpUrl(),
            th_url: z.httpUrl(),
        }).parse(body);

        return {
            page: validated.show_url,
            thumbnail: validated.th_url,
            image: await this.getDirectUrl(validated.show_url),
        } satisfies Image;

    }

}

export const pixhost = new PiXhost();