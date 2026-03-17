<script lang="ts">
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';

    let { field, value, name = '', id = '', imageHosts = [] } = $props()
    // svelte-ignore state_referenced_locally
    id = id ? id : field.id;
    // svelte-ignore state_referenced_locally
    name = name ? name : field.id;

    // svelte-ignore state_referenced_locally
    if (field.type === 'imageHosts') {
        const order = String(value).split(','); // ['Catbox', 'Freeimage.host', 'ImgBB']
        const orderMap: Map<string, number> = new Map(order.map((name: string, index: number) => [name, index]));

        imageHosts.sort((a, b) => {
            const aIndex = orderMap.get(a.name) ?? Infinity;
            const bIndex = orderMap.get(b.name) ?? Infinity;
            return aIndex - bIndex;
        });
    }

    let imageHostFieldValue = $derived(imageHosts.map(item => item.name));

    function handleSort(e: CustomEvent<DndEvent>) {
        imageHosts = e.detail.items;
    }

</script>

<div class="field">
    <p class="control {field.type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}">

        <label for={id}>{field.label}:</label>

        {#if field.type === 'password'}
            <input type="password" {name} {id} {value} />
        {:else if field.type === 'text'}
            <input type="text" {name} {id} {value} />
        {:else if field.type === 'path'}
            <input type="text" {name} {id} {value} />
        {:else if field.type === 'url'}
            <input type="url" {name} {id} {value} />
        {:else if field.type === 'multiline'}
            <textarea {name}{id}>{value}</textarea>
        {:else if field.type === 'imageHosts'}
            <input type="hidden" {name} {id} value={imageHostFieldValue} />
            <span
                use:dndzone={{items: imageHosts, flipDurationMs: 150 }}
                onconsider={handleSort}
                onfinalize={handleSort}
            >
                {#each imageHosts as item (item.id)}
                    <span animate:flip={{ duration: 300 }}><span>⋮⋮ </span> {item.name}</span>
                {/each}
            </span>
        {/if}


    </p>
    {#if field.description}
        <p class="description">{@html field.description}</p>
    {/if}
</div>