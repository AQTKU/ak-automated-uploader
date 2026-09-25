import type { UploadState } from '$lib/server/upload.js';
import { uploads } from '$lib/server/uploads.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, request }) {

    const upload = uploads.get(parseInt(params.id));
    if (!upload) throw error(404);

    let unsubscribe = () => {};

    const stream = new ReadableStream({
        start(controller) {

            const encoder = new TextEncoder();

            const send = (data: Partial<UploadState>) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    unsubscribe();
                }
            };

            const close = () => {
                unsubscribe();
                try { controller.close(); } catch { }
            };

            unsubscribe = () => {
                upload.offUpdate(send);
                upload.signal.removeEventListener('abort', close);
                request.signal.removeEventListener('abort', unsubscribe);
            };

            send(upload.toJSON());
            upload.onUpdate(send);
            upload.signal.addEventListener('abort', close);
            request.signal.addEventListener('abort', unsubscribe);

        },
        cancel() {
            unsubscribe();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });

}
