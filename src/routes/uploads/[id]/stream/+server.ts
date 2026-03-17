import type { UploadState } from '$lib/server/upload.js';
import { uploads } from '$lib/server/uploads.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, request }) {

    const upload = uploads.get(parseInt(params.id));
    if (!upload) throw error(404);

    let handler: (upload: Partial<UploadState>) => void;

    const stream = new ReadableStream({
        start(controller) {

            const encoder = new TextEncoder();

            // Send initial state // Should already have that?
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(upload.toJSON())}\n\n`));

            // Subscribe to updates
            handler = (data: Partial<UploadState>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            upload.onUpdate(handler);

            request.signal.addEventListener('abort', () => {
                upload.offUpdate(handler);
            })

        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });

}