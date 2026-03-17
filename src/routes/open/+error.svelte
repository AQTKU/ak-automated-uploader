<script lang="ts">
    import { page } from '$app/state';
</script>

<svelte:head>
    <title>Error - Open - AK Automated Uploader</title>
</svelte:head>

<main id="open">
    
    <header>
        <h2>Open file or folder</h2>
    </header>

    <p class="error">{page.status}: {page.error?.message}</p>

    <p>There was a problem opening that folder.</p>

    <ul>
        <li><a href="/open">Go back</a></li>
        <li><a href="/open?home">Home folder</a></li>
    </ul>

</main>