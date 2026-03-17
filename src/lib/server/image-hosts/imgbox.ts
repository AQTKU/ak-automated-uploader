import type { Image } from '$lib/types';
import z from 'zod';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import { load } from 'cheerio';
import getCookies from '../util/get-cookies';
import { basename } from 'node:path';

const BASE_URL = 'https://imgbox.com';
const THUMBNAIL_SIZES = [100, 150, 200, 250, 300, 350, 500, 800];

const queue = new PQueue({ concurrency: 1 });

class Imgbox extends ImageHost {

    maxSize = 10 * 1024 * 1024;

    async getCsrfAndCookie() {

        const response = await fetch(new URL('/', BASE_URL));
        const page = load(await response.text());

        const csrf = page('input[name="authenticity_token"]').val();
        if (typeof csrf !== 'string') throw Error("Couldn't get CSRF token");

        if (response.headers.getSetCookie().length < 1) throw Error("Couldn't get cookies");
        const cookie = getCookies(response);

        return { csrf, cookie };

    }

    async getToken(csrf: string, cookie: string) {

        const response = await fetch(new URL('/ajax/token/generate', BASE_URL), {
            method: 'POST',
            headers: {
                'X-CSRF-Token': csrf,
                'Cookie': cookie,
                'X-Requested-With': 'XMLHttpRequest',
            }
        });

        const body = await response.json();

        const TokenSchema = z.object({
            token_id: z.number(),
            token_secret: z.string(),
            gallery_id: z.number().optional(),
            gallery_secret: z.string().optional(),
        });

        const validated = TokenSchema.parse(body);

        return validated;

    }

    getThumbnailSize(width: number = 350) {
        const filtered = THUMBNAIL_SIZES.filter(size => size <= width);
        const sorted = filtered.sort((a, b) => b - a);
        const size = sorted.length < 1 ? THUMBNAIL_SIZES[0] : sorted[0];
        return `${size}r`;
    }

    async post(path: string, thumbnailWidth: number | undefined, signal: AbortSignal): Promise<Image> {

        const { csrf, cookie } = await this.getCsrfAndCookie();
        const token = await this.getToken(csrf, cookie);

        const image = file(path);

        const formData = new FormData();
        formData.append('token_id', String(token.token_id));
        formData.append('token_secret', token.token_secret);
        formData.append('gallery_id', String(token.gallery_id ?? 'null'));
        formData.append('gallery_secret', token.gallery_secret ?? 'null');
        formData.append('content_type', '1');
        formData.append('thumbnail_size', this.getThumbnailSize(thumbnailWidth));
        formData.append('comments_enabled', '0');
        formData.append('files[]', image, basename(path));

        const response = await fetch(new URL('/upload/process', BASE_URL), {
            method: 'POST',
            body: formData,
            signal,
        });

        const body = await response.json();

        const FilesSchema = z.object({
            files: z.array(z.object({
                url: z.httpUrl(),
                original_url: z.httpUrl(),
                thumbnail_url: z.httpUrl(),
            })).length(1),
        });

        const validated = FilesSchema.parse(body);

        return {
            page: validated.files[0]!.url,
            image: validated.files[0]!.original_url,
            thumbnail: validated.files[0]!.thumbnail_url,
        };

    }

    async upload(path: string, thumbnailWidth: number | undefined, signal: AbortSignal) {
        return await queue.add(() => this.post(path, thumbnailWidth, signal));
    }

}

export const imgbox = new Imgbox();