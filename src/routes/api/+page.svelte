<script lang="ts">
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
    // svelte-ignore state_referenced_locally
    let { apiKey, trackers } = data;

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

    function fieldTypeToDataType(type: string) {
        switch (type) {
            case 'checkbox': return 'boolean';
            case 'select': return 'string enum';
            default: return 'string';
        }
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
            {#if apiKey}
                <button type="button" onclick={copy}>
                    {#if copyState === 'success'}
                        ✅ Copied
                    {:else if copyState === 'error'}
                        ❌ Failed
                    {:else}
                        📋 Copy
                    {/if}
                </button>
            {/if}
        </p>

        <form method="post">
            <p class="buttons">
                <button type="submit" formaction="?/generate">🔁 Generate key</button>
                <button type="submit" formaction="?/rescind">✖️ Rescind key</button>
            </p>
        </form>

    </section>

    <section>

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
            <code>true</code> or <code>1</code> for true and anything else for
            false.
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
                <small>string</small>
            </dt>
            <dd>
                The location of the content, as this uploader can see it.
            </dd>

            <dt>
                <code>ignoreDuplicates</code>
                <small>boolean</small>
            </dt>
            <dd>
                Normally, uploading will fail if a duplicate is found on the
                tracker, even by a different release group. Set to true to skip
                that check.
            </dd>

            <dt>
                <code>trackers</code>
                <small>string[]</small>
            </dt>
            <dd>
                Tracker(s) to upload to, named exactly how they appear in the
                UI. In JSON, send as an array of strings, otherwise send
                multiple, like
                <code>?trackers=Tracker 1&trackers=Tracker 2</code>
            </dd>

            <dt>
                <code>set</code>
                <small>{'{ field: string | boolean }[]'}</small>
            </dt>
            <dd>
                Form fields to set immediately before submitting to the tracker.
                Use an object in JSON, like
                <code>{'set: { anonymous: true }'}</code>, or use multiple
                query params, like
                <code>?set=anonymous=true&set=tmdb=1234</code>. See below for a
                field reference.
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
                <small>string</small>
            </dt>
            <dd>
                Explanation of what went wrong.
            </dd>
        </dl>

    </section>

    <section>

        <h3>Tracker field reference</h3>

        {#each trackers as tracker (tracker.name)}

            <h4>{tracker.name}</h4>

            <dl>

                {#each tracker.fields as field (field.key)}
                    <dt>
                        <code>{field.key}</code>
                        <small>{fieldTypeToDataType(field.type)}</small>
                    </dt>
                    <dd>
                        {#if field.type === 'select' && field.options.length > 20}
                            <details>
                                <summary>
                                    {field.label}, one of {field.options.length} options
                                </summary>
                                {@html
                                    field.options
                                        .map(option => `<code>"${option[0]}"</code>${(option[1] && option[1] !== option[0]) ? ` (${option[1]})` : ''}`)
                                        .join(', ')
                                }
                            </details>
                        {:else if field.type === 'select'}
                            {field.label}, one of
                            {@html
                                field.options
                                    .map(option => `<code>"${option[0]}"</code>${(option[1] && option[1] !== option[0]) ? ` (${option[1]})` : ''}`)
                                    .join(', ')
                            }
                        {:else}
                            {field.label}
                        {/if}
                    </dd>
                {/each}

            </dl>

        {/each}

    </section>

</main>