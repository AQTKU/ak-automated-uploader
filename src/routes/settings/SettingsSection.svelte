<script lang="ts">
    import type { ImageHostOrderItem, SettingsField, SettingsOption } from '$lib/types';
    import FormControl from './FormControl.svelte';

    let { id, cssId, name, available, selected, settings, imageHosts = $bindable([]) }: {
        id: 'trackers' | 'imageHosts',
        cssId: string,
        name: string,
        available: SettingsOption[],
        selected: SettingsOption[],
        settings: { name: string, [key: string]: unknown }[],
        imageHosts?: ImageHostOrderItem[],
    } = $props();

    // svelte-ignore state_referenced_locally
    const first = selected[0]?.name ?? '';

    let toAdd = $state('');
    let active = $state(first);

    function updateImageHosts() {
        if (id === 'imageHosts') {
            imageHosts = selected.map((item, index) => ({ id: index, name: item.name }));
        }
    }

    function add() {
        const availableItem = available.find(item => item.name === toAdd);
        if (!availableItem) return;
        selected = [...selected, availableItem];
        available = available.filter(item => item.name !== toAdd);
        updateImageHosts();
        active = toAdd;
    }
    
    function remove(toRemove: string) {
        const selectedItem = selected.find(item => item.name === toRemove);
        if (!selectedItem) return;
        available = [...available, selectedItem];
        selected = selected.filter(item => item.name !== toRemove);
        updateImageHosts();
        active = selected[0]?.name ?? '';
    }

    function findValue(name: string, field: SettingsField) {
        const settingItem = settings.find(item => item.name === name);
        if (!settingItem) return field.default || ''
        if (!(field.id in settingItem)) return '';
        return settingItem[field.id];
    }

</script>

<section id="{cssId}" class={available.length > 0 ? 'tab-group addable' : 'tab-group'}>
    <h3>{name}</h3>

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

        {#each selected as client, i (client.name)}
            <fieldset hidden={active !== client.name}>
                <legend>{client.name}</legend>

                <input type="hidden" name="{id}[{i}][name]" value={client.name}>

                {#if client.fields.length < 1}
                    <p class="no-fields">Nothing to configure</p>
                {/if}

                {#each client.fields as field (field.id)}
                    <FormControl
                        {field}
                        name="{id}[{i}][{field.id}]"
                        id="{id}-{i}-{field.id}"
                        value={findValue(client.name, field)}
                        {imageHosts}
                    />
                {/each}

                <p class="buttons">
                    <button type="button" onclick={() => remove(client.name)}>➖ Remove</button>
                </p>

            </fieldset>

        {/each}

    </div>

</section>