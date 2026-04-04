import * as v from 'valibot';

export async function getWhy(response: Response) {
    try {
        const body = await response.json();
        const validated = v.parse(v.object({ why: v.string() }), body);
        return validated.why;
    } catch {
        return response.statusText;
    }
}