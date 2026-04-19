import type { Actions, PageServerLoad } from './$types';
import { list, type FileInfo } from '$lib/server/file-browser';
import { error, redirect } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { normalize, sep, parse, join } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';
import { uploads } from '$lib/server/uploads';
import { env } from 'bun';

const sortTable: Record<string, string> = {};

function makeBreadcrumbs(fullPath: string): { name: string, path: string }[] {
    fullPath = normalize(fullPath);
    
    const parsed = parse(fullPath);
    const output: { name: string, path: string }[] = [];
    
    // Handle the root specially
    if (parsed.root) {
        output.push({
            name: parsed.root === '/' ? '/' : parsed.root.replace(/[\\\/]+$/, ''), // Clean trailing slashes except for /
            path: parsed.root
        });
    }
    
    // Split the directory part and filter out empty strings
    const parts = parsed.dir
        .replace(parsed.root, '') // Remove root from dir
        .split(sep)
        .filter(p => p); // Remove empty strings
    
    // Build up the path incrementally
    let builtPath = parsed.root;
    for (const part of parts) {
        builtPath = join(builtPath, part);
        output.push({
            name: part,
            path: builtPath
        });
    }
    
    // Add the final file/folder if it exists
    if (parsed.base && parsed.base !== parts[parts.length - 1]) {
        output.push({
            name: parsed.base,
            path: fullPath
        });
    }
   
    return output;
}

function sortFiles(files: FileInfo[], sort: string): string {

    switch (sort) {
        case 'name-desc':
            files.sort((a, b) => b.name.localeCompare(a.name));
            break;

        case 'size-asc':
            files.sort((a, b) => (a.size || 0) - (b.size || 0));
            break;

        case 'size-desc':
            files.sort((a, b) => (b.size || 0) - (a.size || 0));
            break;

        case 'modified-asc':
            files.sort((a, b) => {
                const aTime = a.modified ? Temporal.Instant.from(a.modified).epochMilliseconds : 0;
                const bTime = b.modified ? Temporal.Instant.from(b.modified).epochMilliseconds : 0;
                return aTime - bTime;
            });
            break;

        case 'modified-desc':
            files.sort((a, b) => {
                const aTime = a.modified ? Temporal.Instant.from(a.modified).epochMilliseconds : 0;
                const bTime = b.modified ? Temporal.Instant.from(b.modified).epochMilliseconds : 0;
                return bTime - aTime;
            });
            break;

        default: // Fall back to name-asc
            files.sort((a, b) => a.name.localeCompare(b.name));
            sort = 'name-asc';
    }

    return sort;

}

export const load: PageServerLoad = async ({ url, cookies, locals }) => {

    if (url.searchParams.get('home') !== null) {
        url.searchParams.set('browse', env.HOME || homedir());
        url.searchParams.delete('home');
        redirect(302, url);
    }

    const rawPath = url.searchParams.get('browse') || cookies.get('akauLastBrowsePath') || env.HOME || homedir();
    
    const path = normalize(rawPath);

    if (path !== url.searchParams.get('browse')) {
        url.searchParams.set('browse', path);
        redirect(302, url);
    }

    let sort = url.searchParams.get('sort') || '';
    if (!sort) {
        if (sortTable[path]) {
            sort = sortTable[path];
        }
    }
    
    try {

        const files = await list(path);

        const breadcrumbs = makeBreadcrumbs(path);

        sort = sortFiles(files, sort);
        sortTable[path] = sort;

        if (files) {
            return { files, path, breadcrumbs, sort, timeZone: locals.timeZone, locale: locals.locale };
        }

    } catch (e) {
        const oneDirUp = normalize(join(path, '..'));
        url.searchParams.set('browse', oneDirUp);
        if (oneDirUp === path) error(500);
        else redirect(302, url)
    }

    error(500);

};

export const actions = {
    default: async ({ request }) => {
        const data = await request.formData();
        const selectedPath = String(data.get('path'));
        if (!selectedPath) {
            throw error(400, 'Missing path');
        }
        const uploadId = uploads.create(selectedPath);
        throw redirect(303, `/uploads/${uploadId}`);
    }
} satisfies Actions;