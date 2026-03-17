<script lang="ts">
    import type { TrackerAfterUploadActionState, TrackerFieldState, TrackerSearchResults, TrackerStatus } from '$lib/types';
    import { getWhy } from '$lib/util/get-why';
    import trackerNameToId from '$lib/util/tracker-name-to-id';
    import { SvelteMap } from 'svelte/reactivity';
    import FormControl from './FormControl.svelte';

    let { name, fields, data, uploadId, status, searchResults, actions, errors = $bindable(), hidden }: {
        name: string,
        fields: TrackerFieldState[],
        data: Record<string, string | boolean> | undefined,
        uploadId: number,
        status: TrackerStatus,
        searchResults: TrackerSearchResults,
        actions: TrackerAfterUploadActionState[],
        errors: string[],
        hidden: boolean,
    } = $props();

    const gridAreaAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    let submitted = false;

    async function submit(event: SubmitEvent) {

        if (submitted) return;
        submitted = true;

        event.preventDefault();
        if (!(event.currentTarget instanceof HTMLFormElement)) return;

        const formData = new FormData(event.currentTarget);
        const action = event.submitter instanceof HTMLButtonElement ? event.submitter.value : undefined;
        let endpoint;

        switch (action) {
            case 'upload': endpoint = 'upload'; break;
            case 'preview': endpoint = 'preview'; break;
            default: endpoint = 'save';
        }

        const response = await fetch(`/uploads/${uploadId}/${trackerNameToId(name)}/${endpoint}`, {
            method: 'PUT',
            body: formData
        });

        if (!response.ok) errors = [...errors, await getWhy(response)];

        submitted = false;

    }

    const actionSubmitted = new Set<number>();
    const actionStatuses = new SvelteMap<number, string>();

    async function submitAction(actionId: number) {

        if (actionSubmitted.has(actionId)) return;
        actionSubmitted.add(actionId);
        actionStatuses.set(actionId, '⏳');

        const response = await fetch(
            `/uploads/${uploadId}/${trackerNameToId(name)}/actions/${actionId}`,
            { method: 'POST' }
        );

        if (!response.ok) actionStatuses.set(actionId, `❌ ${await getWhy(response)}`);

        actionStatuses.set(actionId, '✅');
        actionSubmitted.delete(actionId);

    }

</script>


<fieldset 
    class="tracker"
    id="tracker-{trackerNameToId(name)}"
    disabled={['', '⏳ Waiting for MediaInfo and metadata', '🖼️ Uploading screenshots'].includes(status)}
    {hidden}
>

    <form onsubmit={submit}>

        <legend>{name}</legend>

        {#if searchResults.length > 0}
            <aside class="search-results">
                <p>🔍 Possible duplicates:</p>
                <ul>
                    {#each searchResults as searchResult, i}
                        <li>
                            <a href={searchResult.url}>{searchResult.name}</a>
                        </li>
                    {/each}
                </ul>
            </aside>
        {/if}

        <div id="tracker-fields-{trackerNameToId(name)}">
            {#each fields as field, i}
                <FormControl 
                    trackerName={name}
                    {field}
                    value={data ? data[field.id] || undefined : undefined}
                    area={gridAreaAlphabet[i]}
                />
            {/each}
        </div>

        <p class="buttons">
            <button type="submit" name="action" value="save">💾 Save</button>
            <button type="submit" name="action" value="preview">📝 Preview</button>
            <button type="submit" name="action" value="upload">📤 Upload</button>
        </p>

        <p class="status">{status}</p>

        {#if actions.length > 0}
            <aside class="actions">
                <p>🎯 More options:</p>
                <ul>
                    {#each actions as action (action.id)}
                        <li>
                            <button type="button" onclick={() => submitAction(action.id)}>
                                {action.label}
                            </button>
                            {actionStatuses.get(action.id) ?? ''}
                        </li>
                    {/each}
                </ul>
            </aside>
        {/if}

    </form>

</fieldset>


