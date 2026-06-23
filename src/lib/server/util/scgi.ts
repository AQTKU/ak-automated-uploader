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

        const onAbort = () => {
            socket?.terminate();
            reject(Error('Aborted'));
        };

        let socket: Awaited<ReturnType<typeof connect>> | undefined;

        connect({
            unix: socketPath,
            socket: {
                binaryType: 'uint8array',
                open(openedSocket) {
                    socket = openedSocket;
                    openedSocket.write(encodeScgiRequest(encoder.encode(body)));
                },
                data(_socket, data) {
                    chunks.push(data);
                },
                close() {
                    signal?.removeEventListener('abort', onAbort);
                    resolve(decodeScgiResponse(concatBytes(chunks)));
                },
                error(_socket, error) {
                    signal?.removeEventListener('abort', onAbort);
                    reject(error);
                },
            },
        }).catch(error => {
            signal?.removeEventListener('abort', onAbort);
            reject(error);
        });

        signal?.addEventListener('abort', onAbort, { once: true });

    });

}
