import { uploads } from '#lib/server/uploads.js';
import { accepted } from '#lib/server/util/empty-responses.js';
import why from '#lib/server/util/why.js';
import { MetadataValuesSchema } from '#lib/server/metadata-fields.js';
import * as v from 'valibot';

export async function PATCH({ params, request }) {

    let set;

    try {
        const data = await request.json();
        const validated = v.parse(v.object({
            set: MetadataValuesSchema,
        }), data);
        set = validated.set;
    } catch (error) {
        return why(400, 'Problem with input', error);
    }

    const upload = uploads.get(parseInt(params.id));
    if (!upload) return why(404, `Couldn't find upload ${params.id}`);

    try {
        await upload.setMetadataValues(set);
    } catch (error) {
        return why(422, `Couldn't set metadata`, error);
    }

    return accepted();

}
