<script lang="ts">
    import type { TorrentClientSettings } from '$lib/types';
    import type { SettingsField } from '$lib/types';
    import type { SettingsOption } from '$lib/types';
    import FormControl from './FormControl.svelte';

    let { available, selected, settings } = $props();

    const allOptions: SettingsOption[] = [...selected, ...available];

    // svelte-ignore state_referenced_locally
    let active = $state(selected.length > 0 ? selected[0].name : '');

    const client = $derived(allOptions.find((option) => option.name === active));

    function findValue(name: string, field: SettingsField) {
        if (settings?.name !== name) return field.default || '';
        if (!(field.id in settings)) return field.default || '';
        return settings[field.id];
    }

</script>

<section id="torrent-client" class={allOptions.length > 0 ? 'tab-group selectable' : 'tab-group'}>
    <h3>Torrent Client</h3>

    <div>

        <nav class="tabs">
            <select bind:value={active}>
                <option value="">(none)</option>
                {#each allOptions as option (option.name)}
                    <option value={option.name}>{option.name}</option>
                {/each}
            </select>
        </nav>

        {#if client}
            <fieldset>
                <legend>{client.name}</legend>

                <input type="hidden" name="torrentClient[name]" value={client.name}>

                {#if client.fields.length < 1}
                    <p class="no-fields">Nothing to configure</p>
                {/if}

                {#each client.fields as field (field.id)}
                    <FormControl
                        {field}
                        name="torrentClient[{field.id}]"
                        id="torrentClient-{field.id}"
                        value={findValue(client.name, field)}
                    />
                {/each}
            </fieldset>
        {/if}

    </div>

</section>