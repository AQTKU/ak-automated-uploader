import type { SettingsField } from '$lib/types';
import z from 'zod';

export default function buildSchemaFromFields(fields: SettingsField[], name?: string) {
    const shape: Record<string, z.ZodDefault | z.ZodLiteral> = {};

    for (const field of fields) {
        shape[field.id] = z.string().default(field.default || '');
    }

    if (name) {
        shape.name = z.literal(name);
    }

    return z.object(shape);
}