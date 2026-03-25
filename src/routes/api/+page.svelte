<script lang="ts">
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
    // svelte-ignore state_referenced_locally
    let { apiKey } = data;

    let copyTimeout: ReturnType<typeof setTimeout> | undefined;
    let copyState: string | null = $state(null);

    async function copy() {

        if (!apiKey) return;

        try {
            await navigator.clipboard.writeText(apiKey);
            copyState = 'success';
        } catch {
            copyState = 'error';
        }

        if (copyTimeout) clearTimeout(copyTimeout);
        copyTimeout = setTimeout(() => { copyState = null; }, 2000);

    }

    function select(event: FocusEvent) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        target.select();
    }

</script>

<main id="api">

    <header>
        <h2>API</h2>
    </header>

    <section id="api-key">

        <h3>Key</h3>

        <p class="token">
            <input type="text" readonly value={apiKey} onfocus={select} size="55">
            <button type="button" onclick={copy}>
                {#if copyState === 'success'}
                    ✅ Copied
                {:else if copyState === 'error'}
                    ❌ Failed
                {:else}
                    📋 Copy
                {/if}
            </button>
        </p>

        <form method="post">
            <p class="buttons">
                <button type="submit" formaction="?/generate">🔁 Generate key</button>
                <button type="submit" formaction="?/rescind">✖️ Rescind key</button>
            </p>
        </form>

    </section>

<!--    <section>

        <h3>Authentication</h3>

        <p>Provide your API key by using the <code>Authorization</code> header:</p>

        <pre>Authorization: Bearer {apiKey ?? '1234567890abcdef'}</pre>

        <p>Or as an <code>apiKey</code> parameter:</p>

        <pre>?apiKey={apiKey ?? '1234567890abcdef'}</pre>

    </section>

    <section>

        <h3>Supported content types</h3>

        <p>
            Send data with your requests as either JSON or urlencoded params.
            For boolean fields with urlencoded params use the string
            <code>true</code> for true and anything else for false.
        </p>

        <p>
            The server will respond with JSON, or an empty response if there's
            nothing to say. Set the request header
            <code>Accept: application/json</code>.
        </p>

    </section>

    <section>
        
        <h3>Uploading</h3>

        <p>
            <code class="method post">POST</code>
            <code class="endpoint">/api/upload</code>
        </p>

        <h4>Request</h4>

        <dl>

            <dt>
                <code>contentPath</code>
                <small>(string)</small>
            </dt>
            <dd>
                The location of the content, as this uploader can see it.
            </dd>

            <dt>
                <code>ignoreDuplicates</code>
                <small>(boolean)</small>
            </dt>
            <dd>
                Normally, uploading will fail if a duplicate is found on the
                tracker, even by a different release group. Set to true to skip
                that check.
            </dd>

            <dt>
                <code>trackers</code>
                <small>(string[])</small>
            </dt>
            <dd>
                Tracker(s) to upload to, named exactly how they appear in the
                UI. In JSON, send as an array of strings, otherwise send
                multiple, like
                <code>?trackers=Tracker 1&trackers=Tracker 2</code>
            </dd>
        </dl>

        <h4>Response</h4>

        <p>
            On success, returns a 204 with no response body. Otherwise, returns
            a 4xx HTTP code with the following JSON params:
        </p>

        <dl>
            <dt>
                <code>why</code>
                <small>(string)</small>
            </dt>
            <dd>
                Explanation of what went wrong.
            </dd>
        </dl>

    </section>-->

</main>