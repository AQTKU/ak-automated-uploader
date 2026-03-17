<script lang="ts">
    import { page } from '$app/state';
    import type { FilesState } from '$lib/server/files';
    import { getWhy } from '$lib/util/get-why';
    import insertWbr from '$lib/util/insert-wbr';

    let { files, errors = $bindable() }: { files: FilesState, errors: string[] } = $props();

    let debounceTimer: ReturnType<typeof setTimeout>;

    function setScreenshotCount(path: string, count: number) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const response = await fetch(`/uploads/${page.params.id}/set-screenshot-count`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, count }),
            });
            if (!response.ok) errors = [...errors, await getWhy(response)];
        }, 250);
    }

    async function setMediaInfoFile(path: string, isChecked: boolean) {
        if (isChecked) {
            const response = await fetch(`/uploads/${page.params.id}/set-mediainfo-file`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path }),
            });
            if (!response.ok) errors = [...errors, await getWhy(response)];
        }
    }
    
</script>

<section id="files">

    <h3>Files</h3>

    <table>

        <thead>
            <tr>
                <th class="name">File name</th>
                <th class="screenshots"><abbr title="Screenshots">SS</abbr></th>
                <th class="mediainfo"><abbr title="MediaInfo">MI</abbr></th>
            </tr>
        </thead>

        <tbody>
            {#each files as file}
                <tr>
                    <td class="name">{@html insertWbr(file.name)}</td>
                    <td class="screenshots">
                        <input
                            type="number"
                            value={file.screenshots}
                            oninput={e => setScreenshotCount(file.path, parseInt(e.currentTarget.value))}
                        />
                    </td>
                    <td class="mediainfo">
                        <input
                            name="media-info"
                            type="radio"
                            value={file.path}
                            checked={file.mediaInfo}
                            oninput={e => setMediaInfoFile(file.path, e.currentTarget.checked)}
                        />
                    </td>
                </tr>
            {/each}
        </tbody>

    </table>

</section>