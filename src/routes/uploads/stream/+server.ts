import { uploads } from '#lib/server/uploads.js';
import type { UploadsState } from '#lib/types.js';

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

            // Bun closes connections that go quiet for IDLE_TIMEOUT (10s by default)
            const keepAlive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': keep-alive\n\n'));
                } catch {
                    unsubscribe();
                }
            }, 5000);

            unsubscribe = () => {
                clearInterval(keepAlive);
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
