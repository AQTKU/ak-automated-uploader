<script lang="ts">
    import type { TrackerFieldState, FieldLayout } from '$lib/types';
    import { getWhy } from '$lib/util/get-why';
    import buildGridTemplateArea from '$lib/util/build-grid-template-area';
    import FormControl from './FormControl.svelte';

    let { fields, layout, values, baseline, settled, uploadId, errors = $bindable() }: {
        fields: TrackerFieldState[],
        layout: FieldLayout,
        values: Record<string, string | boolean>,
        baseline: Record<string, string | boolean>,
        settled: boolean,
        uploadId: number,
        errors: string[],
    } = $props();

    const fileNameField = 'fileName';

    // svelte-ignore state_referenced_locally
        let local: Record<string, string | boolean> = $state({ ...values });

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

    let fieldsEdited = $derived(fields.some(field => field.id !== fileNameField && edited(field.id)));

    function locked(id: string) {
        return id === fileNameField && fieldsEdited;
    }

    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    function change(id: string, value: string | boolean, immediate: boolean) {

        local[id] = value;

        clearTimeout(timers.get(id));

        function send() {
            timers.delete(id);
            patch(id, value);
        }

        if (immediate) send();
        else timers.set(id, setTimeout(send, 400));

    }

    function revert(id: string) {
        change(id, baseline[id] ?? '', true);
    }

    async function patch(id: string, value: string | boolean) {

        const response = await fetch(`/uploads/${uploadId}/set-release`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ set: { [id]: value } }),
        });

        if (!response.ok) errors = [...errors, await getWhy(response)];

    }

    function handleInput(event: Event) {
        const target = event.target;
        if (target instanceof HTMLTextAreaElement) change(target.name, target.value, false);
        else if (target instanceof HTMLInputElement && target.type !== 'checkbox') change(target.name, target.value, false);
    }

    function handleChange(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement) change(target.name, target.value, true);
        else if (target instanceof HTMLInputElement && target.type === 'checkbox') change(target.name, target.checked, true);
    }

    function handleFocusOut(event: FocusEvent) {
        const id = event.target instanceof HTMLElement ? event.target.getAttribute('name') : null;
        if (!id || timers.has(id)) return;
        local[id] = values[id] ?? '';
    }

</script>


<div id="release-editor" popover="auto">

    <fieldset disabled={!settled}>

        <form oninput={handleInput} onchange={handleChange} onfocusout={handleFocusOut}>

            <div style:grid-template-areas={buildGridTemplateArea(layout)}>
                {#each fields as field}
                    <FormControl
                        idPrefix="release"
                        {field}
                        value={local[field.id]}
                        onrevert={edited(field.id) && !locked(field.id) ? () => revert(field.id) : undefined}
                        disabled={locked(field.id)}
                        title={locked(field.id) ? 'Revert your field edits to edit the filename again' : undefined}
                    />
                {/each}
            </div>

        </form>

    </fieldset>

</div>
