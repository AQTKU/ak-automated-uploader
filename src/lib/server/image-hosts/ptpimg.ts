import type { Image, ImageHostSettings, SettingsField } from '$lib/types';
import * as v from 'valibot';
import ImageHost from '../image-host';
import PQueue from 'p-queue';
import { file } from 'bun';
import sharp from 'sharp';
import { basename } from 'node:path';

const UPLOAD_URL = 'https://ptpimg.me/upload.php';
const REFERER = 'https://ptpimg.me/index.php';
const IMAGE_URL = ({ code, ext }: { code: string; ext: string }) => `https://ptpimg.me/${code}.${ext}`;

export const ptpimgFields: SettingsField[] = [{
    id: 'apiKey',
    label: 'API key',
    type: 'password',
    default: '',
}];

const queue = new PQueue({ concurrency: 1 });

class Ptpimg extends ImageHost {

    apiKey: string = '';
    maxSize = Infinity;

    override async configure(settings: ImageHostSettings) {
        this.apiKey = settings.apiKey ?? '';
    }
    
    async makeThumb(fullSizePath: string, width: number): Promise<Blob> {
        const thumb = sharp(fullSizePath).resize(width).png();
        const buffer = await thumb.toBuffer();
        const typedArray = new Uint8Array(buffer);
        const blob = new Blob([typedArray], { type: 'image/png' });
        return blob;
    }

    async post(image: Blob, filename: string, signal: AbortSignal): Promise<string> {

        const formData = new FormData();
        formData.append('format', 'json');
        formData.append('api_key', this.apiKey);
        formData.append('file-upload[0]', image, filename);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: { referer: REFERER },
            body: formData,
            signal,
        });

        if (!response.ok) {
            throw Error(response.statusText ?? response.status.toString());
        }

        const body = await response.json();

        const Schema = v.pipe(
            v.array(v.object({
                code: v.string(),
                ext: v.string(),
            })),
            v.length(1),
        );
        
        const validated = v.parse(Schema, body);

        return IMAGE_URL(validated[0]!);

    }

    async upload(path: string, width = 350, signal: AbortSignal) {

        const imageUrl = await queue.add(() => this.post(file(path), basename(path), signal), { signal });
        const thumb = await this.makeThumb(path, width);
        const thumbUrl = await queue.add(() => this.post(thumb, basename(path, '.png') + '-thumb.png', signal), { signal });

        return {
            image: imageUrl,
            page: imageUrl,
            thumbnail: thumbUrl
        } satisfies Image;

    }

}

export const ptpimg = new Ptpimg();