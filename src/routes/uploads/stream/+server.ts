import { uploads } from '$lib/server/uploads';
import type { UploadsState } from '$lib/types';

export async function GET({ params, request }) {

    let handler: (uploadsState: UploadsState) => void;

    const stream = new ReadableStream({
        start(controller) {

            const encoder = new TextEncoder();

            // Send initial state // Should already have that?
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(uploads.toJSON())}\n\n`));

            // Subscribe to updates
            handler = (data: UploadsState) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            uploads.onUpdate(handler);

            request.signal.addEventListener('abort', () => {
                uploads.offUpdate(handler);
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