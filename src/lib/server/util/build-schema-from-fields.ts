import type { SettingsField } from '$lib/types';
import * as v from 'valibot';

export default function buildSchemaFromFields(fields: SettingsField[], name?: string) {

    const shape: Record<string, v.LiteralSchema<string, undefined> | v.SchemaWithFallback<v.StringSchema<any>, string>> = {}

    for (const field of fields) {
        shape[field.id] = v.fallback(v.string(), field.default || '');
    }

    if (name) {
        shape.name = v.literal(name);
    }

    return v.object(shape);

}