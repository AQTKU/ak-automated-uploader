import z from 'zod';

const separator = ' ⮞ '

export default function errorString(description: string, error: any): string {
    if (error instanceof z.ZodError) {
        return description + separator + z.prettifyError(error);
    } else if (error instanceof Error) {
        if (error.cause) return errorString(description, error.cause);
        return description + separator + error.message;
    } else if (typeof error === 'string') {
        return description + separator + error;
    }
    return description;
}