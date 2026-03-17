<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types';
    import type { UploadState } from '$lib/server/upload';
    import TmdbPanel from './TmdbPanel.svelte';
    import FilesTable from './FilesTable.svelte';
    import TorrentProgress from './TorrentProgress.svelte';
    import Screenshots from './Screenshots.svelte';
    import Trackers from './Trackers.svelte';
    import insertWbr from '$lib/util/insert-wbr';
    import { getWhy } from '$lib/util/get-why';
    import { browser } from '$app/environment';

    let { data }: { data: PageData } = $props();
    // svelte-ignore state_referenced_locally
    let { errors, id, release, tmdbResults, tmdbSelected, files,
        torrentProgress, screenshots, trackerFields, trackerData, trackerStatus,
        trackerSearchResults, trackerActions
    } = $state(data);

    function updateTitleHeight() {

        if (!browser) return;

        const element = document.querySelector('h2');
        if (!element) return;
        const height = element.offsetHeight;
        document.documentElement.style.setProperty('--title-height', `${height}px`);

    }

    if (browser) {
        window.addEventListener('load', updateTitleHeight);
        window.addEventListener('resize', updateTitleHeight);
    }

    onMount(() => {

        if (CSS.supports('appearance', 'base-select')) {
            document.documentElement.classList.add('supports-base-select');
        }

        updateTitleHeight();

        const eventSource = new EventSource(`/uploads/${data.id}/stream`);
        eventSource.onmessage = (e) => {
            const update = JSON.parse(e.data) as Partial<UploadState>;
            if (update.errors) errors = update.errors;
            if (update.id) id = update.id;
            if (update.release) {
                release = update.release;
                updateTitleHeight();
            }
            if (update.tmdbResults) tmdbResults = update.tmdbResults;
            if (update.tmdbSelected) tmdbSelected = update.tmdbSelected;
            if (update.files) files = update.files;
            if (update.torrentProgress) torrentProgress = update.torrentProgress;
            if (update.screenshots) screenshots = update.screenshots;
            if (update.trackerFields) trackerFields = update.trackerFields;
            if (update.trackerData) trackerData = update.trackerData;
            if (update.trackerStatus) trackerStatus = update.trackerStatus;
            if (update.trackerSearchResults) trackerSearchResults = update.trackerSearchResults;
            if (update.trackerActions) trackerActions = update.trackerActions;
        };
        return () => { eventSource.close(); }

    });

    let closing = false;

    async function close() {

        if (!id || closing) return;
        closing = true;

        const response = await fetch(`/uploads/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const why = await getWhy(response);
            errors = [...errors || [], why];
            closing = false;
            return;
        }

        location.assign('/uploads');

    }
    
</script>

<svelte:head>
    <title>{release?.fileName ?? `Upload ${id}`} - AK Automated Uploader</title>
</svelte:head>

<main id="upload">

    <header>
        <h2>{@html insertWbr(release?.fileName ?? '') }</h2>
        <button onclick={close}>✖️ Close</button>
    </header>

    {#if errors}
        {#each errors as error}
            <p class="error">❌ {error}</p>
        {/each}
    {/if}

    <div>

        <TorrentProgress progress={torrentProgress} />

        {#if tmdbResults && errors}
            <TmdbPanel results={tmdbResults} selected={tmdbSelected} bind:errors={errors} />
        {/if}

        {#if files && errors}
            <FilesTable {files} bind:errors={errors} />
        {/if}

        {#if screenshots}
            <Screenshots {screenshots} />
        {/if}

        {#if trackerFields && trackerData && trackerStatus && trackerActions && id && errors}
            <Trackers {trackerFields} {trackerData} uploadId={id} {trackerStatus} {trackerSearchResults} {trackerActions} bind:errors={errors} />
        {/if}

    </div>

</main>