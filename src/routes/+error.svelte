<script lang="ts">
    import { page } from "$app/state";
</script>

<main id="error">
{#if page.error}
    <h2>{page.error.message}</h2>
{:else}
    <h2>Error</h2>
{/if}
</main>