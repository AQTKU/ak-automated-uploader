import Screenshots from '$lib/server/screenshots';
import type { RequestHandler } from './$types';
import { file } from 'bun';
import resizeImage from '$lib/server/util/resize-image';
import why from '$lib/server/util/why';

export const GET: RequestHandler = async ({ params, url }) => {

    try {

        const path = Screenshots.getPath(params.id);

        const width = Number(url.searchParams.get('w'));
        const body = width > 0
            ? await resizeImage(path, width)
            : await file(path).arrayBuffer();

        return new Response(body, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
            }
        });

    } catch {
        return why(404, 'Screenshot not found');
    }

};