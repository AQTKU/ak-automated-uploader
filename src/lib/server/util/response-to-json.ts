/**
 * Parses a response body as JSON, but throws the response status if the parse fails
 */
export default async function responseToJson(response: Response): Promise<any> {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        const status = `${response.status} ${response.statusText}`.trim();
        throw Error(response.ok ? `Response wasn't JSON (${status})` : status);
    }
}
