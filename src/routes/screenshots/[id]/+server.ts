import Screenshots from '$lib/server/screenshots';
import type { RequestHandler } from './$types';
import { file } from 'bun';
import sharp from 'sharp';
import why from '$lib/server/util/why';

export const GET: RequestHandler = async ({ params, url }) => {

    try {

        const path = Screenshots.getPath(params.id);

        let buffer;

        buffer = await file(path).arrayBuffer();

        const width = Number(url.searchParams.get('w'));
        if (width > 0) {
            const imageBuffer = await sharp(buffer).resize({ width, withoutEnlargement: true }).png().toBuffer();
            buffer = Buffer.from(imageBuffer);
        }

        return new Response(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
            }
        });

    } catch {
        return why(404, 'Screenshot not found');
    }

};