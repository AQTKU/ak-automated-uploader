import PQueue from 'p-queue';
import ImageHost from '../image-host';
import type { Image } from '$lib/types';
import sharp from 'sharp';
import { basename } from 'node:path';
import z from 'zod';
import { file } from 'bun';

const queue = new PQueue({ concurrency: 1 })

class Catbox extends ImageHost {

    maxSize = 200 * 1024 * 1024;

    async upload(path: string, width = 350, signal?: AbortSignal) {

        const image = file(path);
        const imageUrl = await queue.add(() => this.post(image, basename(path), signal));
        const thumb = await this.makeThumb(path, width);
        const thumbUrl = await queue.add(() => this.post(thumb, 'thumb.png', signal));

        return {
            page: imageUrl,
            image: imageUrl,
            thumbnail: thumbUrl,
        } satisfies Image;

    }

    async makeThumb(fullSizePath: string, width: number): Promise<Blob> {
        const thumb = sharp(fullSizePath).resize(width).png();
        const buffer = await thumb.toBuffer();
        const typedArray = new Uint8Array(buffer);
        const blob = new Blob([typedArray], { type: 'image/png' });
        return blob;
    }

    async post(image: Blob, filename: string, signal?: AbortSignal) {

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', image, filename);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData,
            signal,
        });

        const urlOrError = await response.text();
        if (!response.ok) throw Error(urlOrError || response.statusText);

        const url = z.httpUrl(urlOrError).parse(urlOrError);

        /* Catbox has this annoying problem where you'll upload an image and
            it'll give you a 200 and a URL, but the image isn't actually
            there. We'll grab the image back to check, but we really only
            need the size. We're gonna be cute and use a range request to get
            one byte of data and get the full size from the Content-Range
            header. Or just check Content-Length directly as a fallback.
            There's something wrong with HEAD, it always returns
            Content-Length: 0. */
        
        {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Range': 'bytes=0-0' },
                signal,
            });

            if (response.status === 206) {

                const range = response.headers.get('Content-Range');
                const totalSize = parseInt(range?.split('/')[1] ?? '0');
                if (totalSize !== image.size) {
                    throw Error(`File on Catbox is wrong size after upload (expected ${image.size} got ${totalSize})`);
                }

            } else {

                const contentLength = parseInt(response.headers.get('Content-Length') ?? '0');
                await response.body?.cancel();
                if (contentLength !== image.size) {
                    throw Error(`File on Catbox is wrong size after upload (expected ${image.size} got ${contentLength})`);
                }

            }
        }

        return url;

    }

}

export const catbox = new Catbox();