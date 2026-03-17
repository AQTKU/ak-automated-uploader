<script lang="ts">
    import type { TrackerFieldState } from '$lib/types';
    import trackerNameToId from '$lib/util/tracker-name-to-id';

    let { trackerName, field, value, area }: { trackerName: string, field: TrackerFieldState, value: string | boolean | undefined, area?: string } = $props();

    // svelte-ignore state_referenced_locally
        let id = $state(`${trackerNameToId(trackerName)}-${field.id}`);

    // svelte-ignore state_referenced_locally
        if (area) area = `grid-area: ${area}`;

</script>

<div class="field" id="field-{id}" style={area}>
    <p class="control {field.type}">

        {#if field.type === 'checkbox'}

            <label for={id}>
                <input type="checkbox" value="1" name={field.id} {id} checked={value === true}>
                {field.label}
            </label>

        {:else}

            <label for={id}>{field.label}:</label>

            {#if field.type === 'multiline'}

                <textarea {id} name={field.id}>{value || ''}</textarea>

            {:else if field.type === 'select'}

                <select {id} name={field.id}>
                    {#each field.options as option}
                        <option value={option.id} selected={value === option.id}>{option.label}</option>
                    {/each}
                </select>

            {:else if field.type === 'text'}

                <input type="text" {id} name={field.id} value={value || ''}>

            {/if}

        {/if}

    </p>
</div>