<script lang="ts">
    import { page } from '$app/state';
    import type { TmdbSearchResult } from '$lib/server/tmdb';
    import type { FieldLayout, Metadata, TrackerFieldState } from '$lib/types';
    import { getWhy } from '$lib/util/get-why';
    import MetadataEditor from './MetadataEditor.svelte';

    let { results, selected, release, metadataFields, metadataLayout, metadataValues,
        metadataBaseline, uploadId, errors = $bindable() }: {
        results?: TmdbSearchResult[],
        selected?: Metadata,
        release: { category: 'tv' | 'movie' | null, title: string, year: number | null },
        metadataFields: TrackerFieldState[],
        metadataLayout: FieldLayout,
        metadataValues: Record<string, string>,
        metadataBaseline: Record<string, string>,
        uploadId: number,
        errors: string[],
    } = $props();

    let pendingSelectedId = $state();

    let searchOpen = $state(false);
    let searching = $state(false);

    // svelte-ignore state_referenced_locally
        let query = $state(release.title);
    // svelte-ignore state_referenced_locally
        let category = $state(release.category ?? 'movie');
    // svelte-ignore state_referenced_locally
        let year = $state(release.year === null ? '' : String(release.year));

    async function select(tmdbId: number) {
        selected = undefined;
        pendingSelectedId = tmdbId;
        const response = await fetch(`/uploads/${page.params.id}/select-tmdb`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'applicaton/json' },
            body: JSON.stringify({ tmdbId }),
        });
        if (!response.ok) errors = [...errors, await getWhy(response)];
    }

    async function search(event: SubmitEvent) {

        event.preventDefault();
        if (searching) return;

        searching = true;
        pendingSelectedId = undefined;

        try {

            const response = await fetch(`/uploads/${uploadId}/search-tmdb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    category,
                    year: parseInt(year, 10) || null,
                }),
            });

            if (!response.ok) errors = [...errors, await getWhy(response)];
            else searchOpen = false;

        } finally {
            searching = false;
        }

    }
</script>

<section id="tmdb">

    <h3>TMDB</h3>

    <div>

        <ul class="selector">
            {#each results ?? [] as result}
                <li class:selected={pendingSelectedId === result.tmdbId || selected?.tmdbId === result.tmdbId}>
                    <button onclick={() => select(result.tmdbId)}>
                        {result.title} ({result.year}){result.originCountry ? ` (${result.originCountry})` : ''}
                    </button>
                </li>
            {:else}
                <li class="empty">{results && !searching ? 'No results' : 'Searching...'}</li>
            {/each}
            <li><button onclick={() => searchOpen = !searchOpen} aria-expanded={searchOpen}>🔍 Manual search</button></li>
            <li><button popovertarget="metadata-editor" id="metadata-edit">✏️ Edit</button></li>
        </ul>

        <MetadataEditor
            fields={metadataFields}
            layout={metadataLayout}
            values={metadataValues}
            baseline={metadataBaseline}
            {uploadId}
            bind:errors={errors}
        />

        <aside>
            {#if selected?.posterUrl}
                <img alt="{selected.title} poster" src={selected.posterUrl} />
            {/if}
        </aside>

    </div>


    {#if searchOpen}
        <footer>
            <form class="manual-search" onsubmit={search}>
                <input type="search" name="query" aria-label="Search TMDB" placeholder="Title" bind:value={query} />
                <select name="category" aria-label="Category" bind:value={category}>
                    <option value="movie">movie</option>
                    <option value="tv">tv</option>
                </select>
                <input type="text" name="year" aria-label="Year" placeholder="Year" size="4" bind:value={year} />
                <button type="submit" disabled={searching}>🔍</button>
            </form>
        </footer>
    {/if}

</section>
