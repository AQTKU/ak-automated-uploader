import * as v from 'valibot';
import type Upload from '../upload';
import { MetadataValuesSchema } from '../metadata-fields';

const ApiFieldValues = v.fallback(v.record(
    v.string(),
    v.union([v.boolean(), v.string(), v.pipe(v.number(), v.transform(String)), v.file()])
), {});

export const ApiUploadSchema = v.object({
    contentPath: v.string(),
    tracker: v.string(),
    metadata: v.optional(MetadataValuesSchema, {}),
    release: ApiFieldValues,
    data: ApiFieldValues,
    // Deprecated alias for data
    set: ApiFieldValues,
});

/* Metadata flows into the release, and both flow into the tracker, so each is applied after the
   one it depends on. A new TMDB ID is looked up before the release is touched, otherwise the
   titles it brings back would overwrite release edits. */
export default async function applyApiInput(upload: Upload, input: v.InferOutput<typeof ApiUploadSchema>) {

    if (Object.keys(input.metadata).length) await upload.setMetadataValues(input.metadata);
    if (Object.keys(input.release).length) upload.setReleaseValues(input.release);

    const tracker = upload.getTrackerByName(input.tracker);

    for (const [key, value] of Object.entries({ ...input.set, ...input.data })) {
        tracker.set(key, value, false);
    }
    tracker.emitDataChanged();

    return tracker;

}
