<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types';
    import type { TrackerStatus, UploadsState } from '$lib/types';
    import insertWbr from '$lib/util/insert-wbr';
    import { redirect } from '@sveltejs/kit';
    import { getWhy } from '$lib/util/get-why';

    let { data }: { data: PageData } = $props();
    // svelte-ignore state_referenced_locally
    let { uploads } = $state(data);
    let errors: string[] = $state([]);

    onMount(() => {

        const eventSource = new EventSource('/uploads/stream');
        eventSource.onmessage = (event) => {
            const update = JSON.parse(event.data) as UploadsState;
            uploads = update;
        }
        return () => { eventSource.close() };

    });

    /* All non-empty statuses currently present across all uploads
       This was some ceremony for like table cells and stuff, which isn't
       necessary anymore, but I'm keeping it because it maintains the order
       of the icons */
    const activeStatuses = $derived(
        [...new Set(uploads.flatMap(upload => Object.keys(upload.statusCounts)))]
            .filter(status => status !== '')
    ) as TrackerStatus[];

    function splitStatus(status: string): { emoji: string; label: string } {
        const spaceIndex = status.indexOf(' ');
        if (spaceIndex === -1) return { emoji: status, label: status };
        return {
            emoji: status.slice(0, spaceIndex),
            label: status.slice(spaceIndex + 1),
        };
    }

    let closing = new Set();

    async function close(id: number) {

        if (!id || closing.has(id)) return;
        closing.add(id);

        const response = await fetch(`/uploads/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const why = await getWhy(response);
            errors = [...errors || [], why];
            closing.delete(id);
            return;
        }

    }

</script>

<svelte:head>
    <title>Uploads - AK Automated Uploader</title>
</svelte:head>

<main id="uploads">

    <h2>Uploads</h2>

    {#if errors.length > 0}
        {#each errors as error}
            <p class="error">❌ {error}</p>
        {/each}
    {/if}

    {#if uploads.length < 1}
        <p class="buttons"><a href="/open">➕ Create New Upload</a></p>
    {:else}
    
        <table>
            <thead>
                <tr>
                    <th class="name">Name</th>
                    <th class="status">Status</th>
                    <th class="close">Close</th>
                </tr>
            </thead>
            <tbody>
                {#each uploads as upload, i (upload.id)}
                    <tr>
                        <td class="name"><a href="/uploads/{upload.id}">{@html insertWbr(upload.name) }</a></td>
                        <td class="status">
                            {#each activeStatuses as status}
                                {@const count = upload.statusCounts[status]}
                                {@const { emoji, label } = splitStatus(status)}
                                    {#if count}
                                        {count} <abbr title={label}>{emoji}</abbr>
                                    {/if}
                            {/each}
                        </td>
                        <td class="close">
                            <button onclick={() => close(upload.id)}>✖️ Close</button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>

    {/if}

</main>