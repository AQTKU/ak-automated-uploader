import type { RequestHandler } from './$types';
import normalizeApiInput from '$lib/server/util/normalize-api-input';
import why from '$lib/server/util/why';
import { NO_CONTENT } from '$lib/server/util/empty-responses';
import * as v from 'valibot';

export const POST: RequestHandler = async ({ request }) => {
    
    const Schema = v.object({
        contentPath: v.string(),
        ignoreDuplicates: v.optional(v.boolean()),
        trackers: v.array(v.string()),
        set: v.record(
            v.string(),
            v.union([v.boolean(), v.string()])
        )
    });

    let validated;

    try {
        validated = normalizeApiInput(request, Schema);
    } catch (error) {
        return why(422, 'Problem with input', error);
    }

    return NO_CONTENT;

    

};