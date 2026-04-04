<script lang="ts">

    import insertWbr from '$lib/util/insert-wbr';
    import { onMount } from 'svelte';
    import type { PageData } from "./$types";
    import { Temporal } from '@js-temporal/polyfill';
    import { browser } from '$app/environment';

    const { data } = $props();

    const defaultFileIcon = '📃';
    const fileIcons: Record<string, string> = {
        'folder': '📁',
        
        'mkv': '🎬',
        'mp4': '🎬',
        'avi': '🎬',
        'mov': '🎬',
        'wmv': '🎬',
        'flv': '🎬',
        'webm': '🎬',
        'm4v': '🎬',
        
        'mp3': '🎵',
        'flac': '🎵',
        'wav': '🎵',
        'aac': '🎵',
        'm4a': '🎵',
        'ogg': '🎵',
        
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'webp': '🖼️',
        'bmp': '🖼️',
        'svg': '🖼️',
        
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
        'tar': '📦',
        'gz': '📦',
        
        'txt': '📄',
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        
        'json': '📋',
        'xml': '📋',
        'nfo': '📋',
        'log': '📋',
        
        'srt': '💬',
        'sub': '💬',
        'ass': '💬',
        'vtt': '💬',
        'webvtt': '💬',
        
        'torrent': '🧲',
        
        'js': '📜',
        'ts': '📜',
        'py': '📜',
    };

    function getFileIcon(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return fileIcons[ext] || defaultFileIcon;
    }

    function formatBytes(bytes: number, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        // For SI units (KB, MB), change k to 1000 and sizes accordingly.

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatInstant(isoDateTime: string) {
        
        const instant = Temporal.Instant.from(isoDateTime);
        const zonedInstant = instant.toZonedDateTimeISO(data.timeZone);
        const now = Temporal.Now.instant();
        const difference = zonedInstant.since(now.toZonedDateTimeISO(data.timeZone));
        const date = zonedInstant.toPlainDate();
        const today = Temporal.Now.plainDateISO();

        const formatter = new Intl.RelativeTimeFormat(data.locale, { numeric: 'auto' });

        const differenceSeconds = Math.round(difference.total('seconds'));
        if (Math.abs(differenceSeconds) < 60) {
            return formatter.format(differenceSeconds, 'seconds');
        }

        const differenceMinutes = Math.round(difference.total('minutes'));
        if (Math.abs(differenceMinutes) < 100) {
            return formatter.format(differenceMinutes, 'minutes');
        }

        const differenceDays = date.since(today, { largestUnit: 'day' }).days;
        if (Math.abs(differenceDays) <= 1) {
            return formatter.format(differenceDays, 'days') +
                ', ' +
                zonedInstant.toLocaleString(data.locale, data.locale ?
                    { hour: 'numeric', minute: '2-digit' } :
                    { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
                );
        }

        if (date.year === today.year) {
            return zonedInstant.toLocaleString(data.locale, data.locale ?
                { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } :
                { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
            );
        }
        
        return zonedInstant.toLocaleString(data.locale, data.locale ?
            { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' } :
            { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
        );

    }

    onMount(() => {
        
        if (browser) {

            cookieStore.set({
                name: 'lastBrowsePath',
                value: data.path,
                expires: 60 * 60 * 24 * 365
            });

        }

    });

</script>

<svelte:head>
    <title>Open - AK Automated Uploader</title>
</svelte:head>

<main id="open">

    <header>
        <h2>Open file or folder</h2>

        <nav class="breadcrumbs">
            <ul>
                {#each data.breadcrumbs as breadcrumb}
                    <li><a href="?browse={encodeURIComponent(breadcrumb.path)}">{@html insertWbr(breadcrumb.name)}</a></li>
                {/each}
            </ul>
        </nav>
    </header>

    <form method="POST">
        <p class="buttons">
            <input type="hidden" name="path" value={data.path}>
            <button type="submit">📁 Select this folder</button>
        </p>        
    </form>

    <table>
        <thead>

            <tr>
                <th class="name">
                    <a href="?browse={encodeURIComponent(data.path || '')}&sort={data.sort === 'name-asc' ? 'name-desc' : 'name-asc'}">
                        Name
                    </a>
                </th>
                <th class="size">
                    <a href="?browse={encodeURIComponent(data.path || '')}&sort={data.sort === 'size-desc' ? 'size-asc' : 'size-desc'}">
                        Size
                    </a>
                </th>
                <th class="modified">
                    <a href="?browse={encodeURIComponent(data.path || '')}&sort={data.sort === 'modified-desc' ? 'modified-asc' : 'modified-desc'}">
                        Modified
                    </a>
                </th>
            </tr>

        </thead>
        <tbody>

            {#if (data.breadcrumbs || []).length > 1}
                <tr>
                    <td colspan="3" class="name"><a href="?browse={encodeURIComponent(data.path || '')}/..">⬆️ ..</a></td>
                </tr>
            {/if}

            {#each data.files as file}
                <tr>
                    <td class="name">
                        {#if file.isDir}
                            <a href="?browse={encodeURIComponent(file.path)}">📁 {@html insertWbr(file.name) }</a>
                        {:else}
                            <form method="POST">
                                <input type="hidden" name="path" value={file.path}>
                                <button type="submit">{getFileIcon(file.name)} {@html insertWbr(file.name) }</button>
                            </form>
                        {/if}
                    </td>
                    {#if file.size}
                        <td class="size">
                            {formatBytes(Number(file.size))}
                        </td>
                    {:else}
                        <td class="size no-data">-</td>
                    {/if}
                    <td class="modified">
                        {#if file.modified}
                            <time datetime="{file.modified}" title="{file.modified}">
                                {formatInstant(file.modified)}
                            </time>
                        {/if}
                    </td>
                </tr>
            {/each}

        </tbody>
    </table>

</main>