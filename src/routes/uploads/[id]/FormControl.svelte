<script lang="ts">
    import type { TrackerFieldState } from '$lib/types';

    let { idPrefix, field, value, onrevert, disabled = false, title }: {
        idPrefix: string,
        field: TrackerFieldState,
        value: string | boolean | undefined,
        onrevert?: () => void,
        disabled?: boolean,
        title?: string,
    } = $props();

    // svelte-ignore state_referenced_locally
        let id = $state(`${idPrefix}-${field.id}`);

    let text = $derived(typeof value === 'string' ? value : '');

</script>

<div class="field" id="field-{id}" style:grid-area={field.id}>
    <p class="control {field.type}">

        {#if field.type === 'checkbox'}

            <label for={id}>
                <input type="checkbox" value="1" name={field.id} {id} checked={value === true} {disabled} {title}>
                {field.label}
            </label>

        {:else}

            <label for={id}>{field.label}:</label>

            {#if field.type === 'multiline'}

                <!-- Value over selected solves an issue where DOM updates
                     wouldn't occur (presumably in order to prevent user-written
                     data from getting overwritten) -->
                <textarea {id} name={field.id} value={text} {disabled} {title}></textarea>

            {:else if field.type === 'select'}

                <select
                    {id}
                    name={field.id}
                    value={text}
                    {disabled}
                    {title}
                    style:min-width={field.size ? `${field.size}ch` : undefined}
                >
                    {#each field.options as option}
                        <option value={option.id}>{option.label}</option>
                    {/each}
                </select>

            {:else if field.type === 'text'}

                <input type="text" {id} name={field.id} value={text} size={field.size} {disabled} {title}>

            {/if}

        {/if}

        {#if onrevert}
            <button type="button" class="revert" onclick={onrevert} title="Revert {field.label}">↩️</button>
        {/if}

    </p>
</div>
