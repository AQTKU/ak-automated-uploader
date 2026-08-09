<script lang="ts">
    import type { TrackerFieldState, FieldLayout } from '$lib/types';
    import { getWhy } from '$lib/util/get-why';
    import buildGridTemplateArea from '$lib/util/build-grid-template-area';
    import FormControl from './FormControl.svelte';

    let { fields, layout, values, baseline, uploadId, errors = $bindable() }: {
        fields: TrackerFieldState[],
        layout: FieldLayout,
        values: Record<string, string>,
        baseline: Record<string, string>,
        uploadId: number,
        errors: string[],
    } = $props();

    const identityFields = ['tmdbId', 'category'];

    // svelte-ignore state_referenced_locally
        let local: Record<string, string | boolean> = $state({ ...values });

    let loading = $state(false);
    let changed = false;

    $effect(() => {
        const focused = document.activeElement?.getAttribute('name');
        for (const field of fields) {
            if (field.id === focused) continue;
            local[field.id] = values[field.id] ?? '';
        }
    });

    function edited(id: string) {
        return (local[id] ?? '') !== (baseline[id] ?? '');
    }

    const pending = new Map<string, string | boolean>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: Promise<void> = Promise.resolve();

    function change(id: string, value: string | boolean, immediate: boolean) {

        local[id] = value;
        pending.set(id, value);

        clearTimeout(timer);

        if (immediate) send();
        else timer = setTimeout(send, 400);

    }

    function revert(id: string) {
        change(id, baseline[id] ?? '', true);
    }

    function send() {

        timer = undefined;
        if (!pending.size) return;

        const set = Object.fromEntries(pending);
        pending.clear();
        changed = true;

        const reloading = identityFields.some(field => field in set);
        if (reloading) loading = true;

        inFlight = inFlight
            .then(() => patch(set))
            .finally(() => { if (reloading) loading = false; });

    }

    async function patch(set: Record<string, string | boolean>) {

        try {

            const response = await fetch(`/uploads/${uploadId}/set-metadata`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ set }),
            });

            if (!response.ok) errors = [...errors, await getWhy(response)];

        } catch (error) {
            errors = [...errors, `Couldn't save metadata: ${error instanceof Error ? error.message : error}`];
        }

    }

    async function handleToggle(event: ToggleEvent) {

        if (event.newState !== 'closed') return;

        clearTimeout(timer);
        send();
        await inFlight;

        if (!changed) return;
        changed = false;

        const response = await fetch(`/uploads/${uploadId}/search-trackers`, { method: 'POST' });
        if (!response.ok) errors = [...errors, await getWhy(response)];

    }

    function handleInput(event: Event) {
        const target = event.target;
        if (target instanceof HTMLTextAreaElement) change(target.name, target.value, false);
        else if (target instanceof HTMLInputElement) change(target.name, target.value, false);
    }

    function handleChange(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement) change(target.name, target.value, true);
    }

    function handleFocusOut(event: FocusEvent) {
        const id = event.target instanceof HTMLElement ? event.target.getAttribute('name') : null;
        if (!id || pending.has(id)) return;
        local[id] = values[id] ?? '';
    }

</script>


<div id="metadata-editor" popover="auto" ontoggle={handleToggle}>

    <form oninput={handleInput} onchange={handleChange} onfocusout={handleFocusOut}>

        <div style:grid-template-areas={buildGridTemplateArea(layout)}>
            {#each fields as field}
                <FormControl
                    idPrefix="metadata"
                    {field}
                    value={local[field.id]}
                    onrevert={edited(field.id) ? () => revert(field.id) : undefined}
                    disabled={loading && field.id !== 'tmdbId'}
                />
            {/each}
        </div>

    </form>

</div>
