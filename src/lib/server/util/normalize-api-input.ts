import * as v from 'valibot';

type ParseableShape =
    | v.RecordSchema<any, any, any>
    | v.ObjectSchema<v.ObjectEntries, any>
    | v.ArraySchema<any, any>
    | v.StringSchema<any>
    | v.NumberSchema<any>
    | v.BooleanSchema<any>
    | v.UnionSchema<any, any>;

function unwrap(shape: any): ParseableShape {
    while (shape.type === 'fallback' || shape.type === 'optional') {
        shape = v.unwrap(shape);
    }
    return shape;
}

function parsePrimitive(
    value: any,
    schema: ParseableShape
): string | number | boolean {

    if (schema.type === 'number') {
        return Number(value);
    }

    if (schema.type === 'boolean') {
        if (typeof value === 'string') {
            return (value === 'true' || value === '1');
        } else {
            return !!value;
        }
    }

    if (schema.type === 'union') {
        for (const option of schema.options) {
            const unwrapped = unwrap(option);

            switch (unwrapped.type) {

                case 'boolean':
                    if (value === 'true' || value === '1') return true;
                    if (value === 'false' || value === '0') return false;
                    break;

                case 'number':
                    const number = Number(value);
                    if (!Number.isNaN(number)) return number;
                    break;

                case 'string':
                    return String(value);

            }

        }
    }

    return String(value);

}

function parseParams(params: URLSearchParams, schema: v.ObjectSchema<v.ObjectEntries, any>): Record<string, unknown> {

    const result: Record<string, unknown> = {};

    for (const [key, shape] of Object.entries(schema.entries)) {

        const values = params.getAll(key);
        if (!values.length) continue;

        let unwrappedShape = unwrap(shape);

        if (unwrappedShape.type === 'record') {

            result[key] = Object.fromEntries(
                values.map(value => {
                    const [recordKey, ...recordValues] = value.split('=');
                    if (!recordKey || !recordValues.length) throw Error(`Expected key=value pairs in field ${key}`);
                    const recordValue = recordValues.join('=');
                    return [recordKey, parsePrimitive(recordValue, unwrappedShape.value)];
                })
            );

        } else if (unwrappedShape.type === 'object') {

            result[key] = Object.fromEntries(
                values.map(value => {
                    const [recordKey, ...recordValues] = value.split('=');
                    if (!recordKey || !recordValues.length) throw Error(`Expected key=value pairs in field ${key}`);
                    const recordValue = recordValues.join('=');
                    const fieldSchema = unwrappedShape.entries[recordKey];
                    if (!fieldSchema) throw Error(`Unexpected key ${recordKey} in field ${key}`);
                    return [recordKey, parsePrimitive(recordValue, unwrap(fieldSchema))];
                })
            );

        } else if (unwrappedShape.type === 'array') {

            result[key] = values.map(value => parsePrimitive(value, unwrappedShape.item));

        } else {

            result[key] = parsePrimitive(values[values.length - 1], unwrappedShape);

        }

    }

    return result;

}

export default async function normalizeApiInput<T extends v.ObjectSchema<v.ObjectEntries, any>>(
    request: Request,
    schema: T
): Promise<v.InferOutput<T>> {

    const url = new URL(request.url);
    const urlParams = parseParams(url.searchParams, schema);
    let body = {};

    const contentType = request.headers.get('Content-Type');
    switch (contentType?.split(';')[0]?.toLowerCase()) {

        case 'application/x-www-form-urlencoded':
            const bodyParams = new URLSearchParams(await request.text());
            body = parseParams(bodyParams, schema);
            break;

        case 'application/json':
            body = await request.json();
            break;

    }

    return v.parse(schema, {...urlParams, ...body});

}