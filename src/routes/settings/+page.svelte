<script lang="ts">
    import { onMount } from 'svelte';
    import type { ActionData, PageData } from "./$types";
    import General from './General.svelte';
    import SettingsSection from './SettingsSection.svelte';
    import TorrentClients from './TorrentClients.svelte';
    import Buttons from './Buttons.svelte';

    let { data, form }: { data: PageData, form: ActionData } = $props();

    let imageHosts: { id: number, name: string }[] = $state([]);
    // svelte-ignore state_referenced_locally
    imageHosts = data.settings.imageHosts.map((imageHost, index) => ({ id: index, name: imageHost.name }));

    onMount(() => {
        if (CSS.supports('appearance', 'base-select')) {
            document.documentElement.classList.add('supports-base-select');
        }
    });

    // svelte-ignore state_referenced_locally
    let resetAuthTokenFormVisible = $state(form?.from === 'resetAuthToken');

    function toggleResetAuthTokenForm() {
        resetAuthTokenFormVisible = !resetAuthTokenFormVisible;
    }

</script>

<svelte:head>
    <title>Settings - AK Automated Uploader</title>
</svelte:head>

<main id="settings">

    <header>
        <h2>Settings</h2>
    </header>

    {#if form?.success}
        <p class="success">✔️ Settings saved</p>
    {/if}

    {#if form?.success === false}
        <p class="error">❌ {form.why}</p>
    {/if}

    <form method="post" hidden={!resetAuthTokenFormVisible} action="?/resetAuthToken">

        <Buttons {resetAuthTokenFormVisible} {toggleResetAuthTokenForm} />

        <section id="reset-auth-token">

            <h3>Reset login token</h3>

            <div>

                <fieldset>

                    <div class="field">
                        <p class="control password">
                            <label for="authToken">Current login token:</label>
                            <input type="password" name="authToken" id="authToken" autocomplete="current-password">
                        </p>
                        <p class="description">Enter your current login token and press Save. This action logs you out and shows you a new token.</p>
                    </div>

                </fieldset>

            </div>

        </section>

        <Buttons {resetAuthTokenFormVisible} />

    </form>

    <form hidden={resetAuthTokenFormVisible} method="post" action="?/save">

        <Buttons {resetAuthTokenFormVisible} {toggleResetAuthTokenForm} />

        <General fields={data.fields.general} settings={data.settings} />

        <SettingsSection
            id="trackers"
            cssId="trackers"
            name="Trackers"
            available={data.availableTrackers}
            selected={data.selectedTrackers}
            settings={data.settings.trackers}
            {imageHosts}
        />

        <SettingsSection
            id="imageHosts"
            cssId="image-hosts"
            name="Image Hosts"
            available={data.availableImageHosts}
            selected={data.selectedImageHosts}
            settings={data.settings.imageHosts}
            bind:imageHosts={imageHosts}
        />

        <TorrentClients
            available={data.availableTorrentClients}
            selected={data.selectedTorrentClients}
            settings={data.settings.torrentClient}
        />

        <Buttons {resetAuthTokenFormVisible} />

    </form>

</main>