<script lang="ts">
    import type { TrackerFieldState } from '$lib/types';

    let { idPrefix, field, value, onrevert, onclear, disabled = false, title }: {
        idPrefix: string,
        field: TrackerFieldState,
        value: string | boolean | undefined,
        onrevert?: () => void,
        onclear?: () => void,
        disabled?: boolean,
        title?: string,
    } = $props();

    // svelte-ignore state_referenced_locally
        let id = $state(`${idPrefix}-${field.id}`);

    let text = $derived(typeof value === 'string' ? value : '');

    /* A file input can't be given the file the server already has, so it only carries a newly
       chosen one, and removing the current one is sent as an empty value in its place */
    let fileInput: HTMLInputElement | undefined = $state();
    let picked: string | null = $state(null);
    let cleared = $state(false);
    let fileName = $derived(cleared ? '' : picked ?? text);

    // A new value from the server means the pick or removal made here has landed, or been replaced
    $effect(() => {
        text;
        picked = null;
        cleared = false;
        if (fileInput) fileInput.value = '';
    });

    function pick() {
        const file = fileInput?.files?.[0];
        if (!file) return;
        picked = file.name;
        cleared = false;
    }

    function clear() {
        picked = null;
        cleared = true;
        if (fileInput) fileInput.value = '';
        onclear?.();
    }

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

            {:else if field.type === 'file'}

                <input type="file" {id} name={cleared ? undefined : field.id} accept={field.accept} hidden bind:this={fileInput} onchange={pick} {disabled}>
                {#if cleared}
                    <input type="hidden" name={field.id} value="">
                {/if}

                <span class="file">
                    {#if fileName}
                        <span class="file-name">📄 {fileName}</span>
                        <button type="button" class="clear" onclick={clear} {disabled} title="Remove {field.label}">✖️</button>
                    {/if}
                    <button type="button" onclick={() => fileInput?.click()} {disabled} {title}>📂 {fileName ? 'Replace' : 'Choose'}</button>
                </span>

            {:else if field.type === 'text'}

                <input type="text" {id} name={field.id} value={text} size={field.size} {disabled} {title}>

            {/if}

        {/if}

        {#if onrevert}
            <button type="button" class="revert" onclick={onrevert} title="Revert {field.label}">↩️</button>
        {/if}

    </p>
</div>
