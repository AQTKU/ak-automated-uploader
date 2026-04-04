<script lang="ts">
    import type { string } from 'valibot';
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

    function formatOption([key, value]: [string, string]) {

        let output = key ? `<code>${key}</code>` : 'an empty string';
        if (value && value !== key) output += ` (${value})`;
        
        return output;

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
            Send data with your requests as either JSON, urlencoded params, or
            multipart form data. For boolean fields with form data or urlencoded
            params, use the string <code>true</code> or <code>1</code> for true
            and <code>false</code> or <code>0</code> for false.
        </p>

        <p>
            The server will respond with JSON if you set
            <code>Accept: application/json</code>, plain text otherwise, or an
            empty response if there's nothing to say.
        </p>

    </section>

    <section>
        
        <h3>Upload</h3>

        <p>
            <code class="method post">POST</code>
            <code class="endpoint">/api/upload</code>
        </p>

        <p>Uploads a file to a tracker.</p>

        <h4>Request</h4>

        <dl>

            <dt>
                <var>contentPath</var>
                <small>string</small>
            </dt>
            <dd>
                The location of the content, as this uploader can see it.
            </dd>

            <dt>
                <var>tracker</var>
                <small>string</small>
            </dt>
            <dd>
                Tracker to upload to, named exactly how they appear in the UI.
            </dd>

            <dt>
                <var>set</var>
                <small>{'{ field: string | boolean }[]'}</small>
            </dt>
            <dd>
                Form fields to override before sending the upload to the
                tracker. Use an object in JSON, like
                <code>{'"set": { "anonymous": true, "tmdb": 1234 }'}</code>,
                or use multiple query params, like
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
                <var>why</var>
                <small>string</small>
            </dt>
            <dd>
                Explanation of what went wrong.
            </dd>
        </dl>

    </section>

    <section>
        
        <h3>Preview</h3>

        <p>
            <code class="method post">POST</code>
            <code class="endpoint">/api/preview</code>
        </p>

        <p>
            Prepares a file for upload to a tracker, but doesn't upload it.
            Complete the upload in the UI.
        </p>

        <h4>Request</h4>

        <dl>

            <dt>
                <var>contentPath</var>
                <small>string</small>
            </dt>
            <dd>
                The location of the content, as this uploader can see it.
            </dd>

            <dt>
                <var>tracker</var>
                <small>string</small>
            </dt>
            <dd>
                Tracker to upload to, named exactly how they appear in the UI.
            </dd>

            <dt>
                <var>set</var>
                <small>{'{ field: string | boolean }[]'}</small>
            </dt>
            <dd>
                Form fields to override before sending the upload to the
                tracker. Use an object in JSON, like
                <code>{'"set": { "anonymous": true, "tmdb": 1234 }'}</code>,
                or use multiple query params, like
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
                <var>why</var>
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
                        <var>{field.key}</var>
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
                                        .map(option => formatOption(option))
                                        .join(', ')
                                }
                            </details>
                        {:else if field.type === 'select'}
                            {field.label}, one of:
                            {@html
                                field.options
                                    .map(option => formatOption(option))
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