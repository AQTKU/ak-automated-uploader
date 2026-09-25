import { uploads } from '$lib/server/uploads';
import type { UploadsState } from '$lib/types';

export async function GET({ request }) {

    let unsubscribe = () => {};

    const stream = new ReadableStream({
        start(controller) {

            const encoder = new TextEncoder();

            const send = (data: UploadsState) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    unsubscribe();
                }
            };

            unsubscribe = () => {
                uploads.offUpdate(send);
                request.signal.removeEventListener('abort', unsubscribe);
            };

            send(uploads.toJSON());
            uploads.onUpdate(send);
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
