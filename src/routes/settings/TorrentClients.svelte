<script lang="ts">
    import type { TorrentClientSettings } from '$lib/types';
    import type { SettingsField } from '$lib/types';
    import type { SettingsOption } from '$lib/types';
    import FormControl from './FormControl.svelte';

    let { available, selected, settings } = $props();

    // svelte-ignore state_referenced_locally
    const first: string = selected.length > 0 ? selected[0].name : '';

    let toAdd = $state('');
    let active = $state(first);

    function add() {
        const availableItem = available.find((item: SettingsOption) => item.name === toAdd);
        if (!availableItem) return;
        selected = [...selected, availableItem];
        available = available.filter((item: SettingsOption) => item.name !== toAdd);
        active = toAdd;
    }
    
    function remove(toRemove: string) {
        const selectedItem = selected.find((item: SettingsOption) => item.name === toRemove);
        if (!selectedItem) return;
        available = [...available, selectedItem];
        selected = selected.filter((item: SettingsOption) => item.name !== toRemove);
        active = selected.length > 0 ? selected[0].name : '';
    }

    function findValue(name: string, field: SettingsField) {
        if (settings?.name !== name) return field.default || '';
        if (!(field.id in settings)) return field.default || '';
        return settings[field.id];
    }

</script>

<section id="torrent-client" class={available.length > 0 ? 'tab-group addable' : 'tab-group'}>
    <h3>Torrent Client</h3>

    <div>
    
        <nav class="tabs">
            <ul class="selector">
                {#each selected as client (client.name)}
                    <li class:selected={active === client.name}>
                        <button 
                            type="button"
                            onclick={() => active = client.name}
                        >{client.name}</button>
                    </li>
                {/each}
            </ul>
        </nav>

        {#if available.length > 0}
            <p class="add-tab">
                <select bind:value={toAdd}>
                    {#each available as client (client.name)}
                        <option value={client.name}>{client.name}</option>
                    {/each}
                </select>
                <button type="button" onclick={add}>➕ Add</button>
            </p>
        {/if}

        {#each selected as client (client.name)}
            <fieldset hidden={active !== client.name}>
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

                <p class="buttons">
                    <button type="button" onclick={() => remove(client.name)}>➖ Remove</button>
                </p>

            </fieldset>

        {/each}

    </div>

</section>