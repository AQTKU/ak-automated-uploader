<script lang="ts">
    import type { string } from 'valibot';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
    // svelte-ignore state_referenced_locally
    let { apiKey, trackers, metadataFields, releaseFields } = data;

    type ReferenceField = {
        key: string;
        label: string;
        type: string;
        options?: [key: string, value: string][];
    };

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
            case 'file': return 'file';
            case 'list': return 'string[]';
            default: return 'string';
        }
    }

    function formatOption([key, value]: [string, string]) {

        let output = key ? `<code>${key}</code>` : 'an empty string';
        if (value && value !== key) output += ` (${value})`;
        
        return output;

    }

</script>

{#snippet fieldParams()}

    <dt>
        <var>metadata</var>
        <small>{'{ field: string | string[] }'}</small>
    </dt>
    <dd>
        Fields to set in the metadata panel. Changing <code>tmdbId</code> or
        <code>category</code> looks the entry up on TMDB again, replacing the
        rest of the metadata, so set any other metadata fields alongside it to
        override what TMDB returns.
    </dd>

    <dt>
        <var>release</var>
        <small>{'{ field: string | boolean }'}</small>
    </dt>
    <dd>
        Fields to set in the release editor, for when the filename isn't
        parsed the way you want.
    </dd>

    <dt>
        <var>data</var>
        <small>{'{ field: string | boolean }'}</small>
    </dt>
    <dd>
        Fields to set in the tracker's form before uploading.
    </dd>

    <dd>
        These are applied in order: <var>metadata</var>, then
        <var>release</var>, then <var>data</var>. Metadata and release changes
        fill in the tracker's form the same way they do in the UI, and
        <var>data</var> has the final say.
    </dd>
    <dd>
        Use an object in JSON, like
        <code>{'"data": { "anonymous": true, "categoryId": 4 }'}</code>, or
        repeat a param once per field, like
        <code>?metadata=tmdbId=1234&release=repack=true&data=anonymous=true</code>.
        See below for field references.
    </dd>
    <dd>
        Send a file field, like <code>nfo</code>, as multipart form data with
        the field name in brackets, like <code>release[nfo]</code>. Set it on
        <var>release</var> to use it for every tracker, or on
        <var>data</var> for just this one. Leave it out to keep the file the
        uploader found, or set it to an empty string to send none.
    </dd>
    <dd>
        <var>set</var> still works as another name for <var>data</var>, but
        it's deprecated.
    </dd>

{/snippet}

{#snippet fieldReference(fields: readonly ReferenceField[])}

    {#each fields as field (field.key)}
        <dt>
            <var>{field.key}</var>
            <small>{fieldTypeToDataType(field.type)}</small>
        </dt>
        <dd>
            {#if field.type === 'select' && field.options && field.options.length > 20}
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
            {:else if field.type === 'select' && field.options}
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

{/snippet}

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

            {@render fieldParams()}
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

            {@render fieldParams()}
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

        <h3>Metadata field reference</h3>

        <p>
            Fields in the metadata panel, for <var>metadata</var>. Send a list,
            like <code>genres</code>, as an array in JSON, like
            <code>{'"genres": ["Drama", "Crime"]'}</code>. In params, repeat it,
            like <code>?metadata=genres=Drama&metadata=genres=Crime</code>, or
            separate items with commas, like
            <code>?metadata=genres=Drama,Crime</code>. Spaces around each item
            are trimmed.
        </p>

        <dl>
            {@render fieldReference(metadataFields)}
        </dl>

    </section>

    <section>

        <h3>Release field reference</h3>

        <p>
            Fields in the release editor, for <var>release</var>. Setting
            <code>fileName</code> parses it again from scratch before any other
            release fields are applied.
        </p>

        <dl>
            {@render fieldReference(releaseFields)}
        </dl>

    </section>

    <section>

        <h3>Tracker field reference</h3>

        <p>Fields in each tracker's form, for <var>data</var>.</p>

        {#each trackers as tracker (tracker.name)}

            <h4>{tracker.name}</h4>

            <dl>

                {@render fieldReference(tracker.fields)}

            </dl>

        {/each}

    </section>

</main>