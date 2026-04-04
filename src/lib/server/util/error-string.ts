import * as v from 'valibot';

const separator = ' ⮞ '

export default function errorString(description: string, error: any): string {

    if (error instanceof v.ValiError) {

        const flattened = v.flatten(error.issues);
        const parts: string[] = [];

        if (flattened.root) parts.push(flattened.root.join(', '));
        if (flattened.other) parts.push(flattened.other.join(', '));

        const entries = Object.entries(flattened.nested ?? {});
        const mapped = entries.map(([key, values]) => `${values?.join(', ')} (${key})`);

        return description + separator + mapped.join('; ');

    } else if (error instanceof Error) {

        if (error.cause) return errorString(description, error.cause);
        return description + separator + error.message;

    } else if (typeof error === 'string') {
        return description + separator + error;
    }

    return description;
}