import settings from '$lib/server/settings';
import { type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { TrackerFieldState } from '$lib/types';
import { trackers } from '$lib/server/trackers/index';
import { metadataFields } from '$lib/server/metadata-fields';
import { releaseFields } from '$lib/server/release-fields';

function toReferenceField(field: TrackerFieldState) {
    return {
        key: field.id,
        label: field.label,
        type: field.type,
        options: field.type === 'select'
            ? field.options.map(option => [option.id, option.label] as [string, string])
            : [],
    };
}

export const load = (async () => {

    return {
        apiKey: settings.apiKey,
        trackers: Object.entries(trackers).map(tracker => ({ name: tracker[0], fields: tracker[1].fields })),
        metadataFields: metadataFields.map(toReferenceField),
        releaseFields: releaseFields.map(toReferenceField),
    }

}) satisfies PageServerLoad;

export const actions = {

    generate: async () => {
        await settings.generateApiKey();
    },

    rescind: async () => {
        await settings.rescindApiKey();
    },

} satisfies Actions;
