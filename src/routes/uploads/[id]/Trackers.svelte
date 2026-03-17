<script lang="ts">
    import type { TrackerFieldsState, TrackersAfterUploadActionsState, TrackerSearchResultState, TrackerState, TrackerStatusState } from '$lib/types';
    import Tracker from './Tracker.svelte';

    let { trackerFields, trackerData, uploadId, trackerStatus, trackerSearchResults, trackerActions, errors = $bindable() }: {
        trackerFields: TrackerFieldsState[],
        trackerData: TrackerState[],
        uploadId: number,
        trackerStatus: TrackerStatusState[],
        trackerSearchResults?: TrackerSearchResultState[],
        trackerActions: TrackersAfterUploadActionsState[],
        errors: string[],
    } = $props();

    // svelte-ignore state_referenced_locally
    const first: string | undefined = trackerFields.length > 0 ? trackerFields[0]?.name : '';
    let active = $state(first);

</script>

<section id="trackers" class="tab-group">

    <h3>Trackers</h3>

    <div>

        <nav class="tabs">
            <ul class="selector">
                {#each trackerFields as tracker}
                    <li class:selected={active === tracker.name}>
                        <button 
                            type="button"
                            onclick={() => active = tracker.name}
                        >
                            {tracker.name}
                            {trackerStatus.find(status => status.tracker === tracker.name)?.status.split(' ')[0] || ''}
                        </button>
                    </li>
                {/each}
            </ul>
        </nav>

        {#each trackerFields as tracker}
            
            <Tracker
                name={tracker.name}
                fields={tracker.fields}
                data={trackerData.find(trackerData => trackerData.name === tracker.name)?.data}
                {uploadId}
                status={trackerStatus.find(trackerStatus => trackerStatus.tracker === tracker.name)?.status || ''}
                searchResults={trackerSearchResults?.find(searchResult => searchResult.tracker === tracker.name)?.results || [] }
                actions={trackerActions.find(action => action.tracker === tracker.name)?.actions || []}
                hidden={tracker.name !== active}
                bind:errors={errors}
            />

        {/each}

    </div>

</section>