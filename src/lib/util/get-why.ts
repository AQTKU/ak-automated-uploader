import z from 'zod';

export async function getWhy(response: Response) {
    try {
        const body = await response.json();
        const validated = z.object({ why: z.string() }).parse(body);
        return validated.why;
    } catch {
        return response.statusText;
    }
}