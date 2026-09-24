import { connect } from 'bun';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concatBytes(chunks: Uint8Array[]): Uint8Array {

    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(length);

    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;

}

function encodeScgiRequest(body: Uint8Array): Uint8Array {

    const headers = ['CONTENT_LENGTH', `${body.length}`, 'SCGI', '1', ''].join('\0');
    const head = encoder.encode(`${headers.length}:${headers},`);

    return concatBytes([head, body]);

}

/* SCGI responses are CGI-style: headers, a blank line, then the body. The
   separator is searched for byte-by-byte since headers are always ASCII,
   leaving the (possibly UTF-8) body bytes undisturbed for decoding. */
function decodeScgiResponse(response: Uint8Array): string {

    const separator = [13, 10, 13, 10]; // \r\n\r\n
    let headerEnd = -1;

    outer: for (let index = 0; index <= response.length - separator.length; index++) {
        for (let offset = 0; offset < separator.length; offset++) {
            if (response[index + offset] !== separator[offset]) continue outer;
        }
        headerEnd = index;
        break;
    }

    const bodyStart = headerEnd === -1 ? 0 : headerEnd + separator.length;

    return decoder.decode(response.subarray(bodyStart));

}

export async function scgiRequest(socketPath: string, body: string, signal?: AbortSignal): Promise<string> {

    if (signal?.aborted) throw Error('Aborted');

    return new Promise<string>((resolve, reject) => {

        const chunks: Uint8Array[] = [];
        let unsent = encodeScgiRequest(encoder.encode(body));
        let socket: Awaited<ReturnType<typeof connect>> | undefined;
        let settled = false;

        const settle = (error?: Error) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            if (error) reject(error);
            else resolve(decodeScgiResponse(concatBytes(chunks)));
        };

        /* terminate() runs the close handler synchronously, so reject first
           or close would resolve with whatever partial response had arrived */
        const onAbort = () => {
            settle(Error('Aborted'));
            socket?.terminate();
        };

        /* Bun's socket.write() is unbuffered and may only take part of a large
           request, so the rest is written as the socket drains */
        const writeUnsent = (openSocket: NonNullable<typeof socket>) => {
            const written = openSocket.write(unsent);
            if (written > 0) unsent = unsent.subarray(written);
        };

        connect({
            unix: socketPath,
            socket: {
                binaryType: 'uint8array',
                open(openedSocket) {
                    socket = openedSocket;
                    openedSocket.timeout(60);
                    writeUnsent(openedSocket);
                },
                drain(openSocket) {
                    if (unsent.length > 0) writeUnsent(openSocket);
                },
                data(_socket, data) {
                    chunks.push(data);
                },
                close() {
                    if (unsent.length > 0) settle(Error('Connection closed before the request was sent'));
                    else settle();
                },
                timeout() {
                    settle(Error('Timed out waiting for rtorrent'));
                },
                error(_socket, error) {
                    settle(error);
                },
            },
        }).catch(error => settle(error));

        signal?.addEventListener('abort', onAbort, { once: true });

    });

}
