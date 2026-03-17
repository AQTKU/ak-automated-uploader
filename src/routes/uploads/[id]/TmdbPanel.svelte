<script lang="ts">
    import { page } from '$app/state';
    import type { TmdbSearchResult } from '$lib/server/tmdb';
    import type { TmdbHydratedSearchResult } from '$lib/types';
    import { getWhy } from '$lib/util/get-why';
    
    let { results, selected, errors = $bindable() }: { results: TmdbSearchResult[], selected?: TmdbHydratedSearchResult, errors: string[] } = $props();

    let pendingSelectedId = $state();

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
</script>

<section id="tmdb">

    <h3>TMDB</h3>

    <div>

        <ul class="selector">
            {#each results as result}
                <li class:selected={pendingSelectedId === result.tmdbId || selected?.tmdbId === result.tmdbId}>
                    <button onclick={() => select(result.tmdbId)}>
                        {result.title} ({result.year}){result.originCountry ? ` (${result.originCountry})` : ''}
                    </button>
                </li>
            {/each}
        </ul>

        <aside>
            {#if selected}
                <img alt="{selected.title} poster" src={selected.posterUrl} />
            {/if}
        </aside>

    </div>

</section>