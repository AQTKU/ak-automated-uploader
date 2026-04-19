import { Temporal } from '@js-temporal/polyfill';
import { file } from 'bun';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pauseHashing, resumeHashing } from './torrent';

export interface FileInfo {
    name: string;
    path: string;
    isDir: boolean;
    size?: number;
    modified?: string;
}

async function getItem(name: string, path: string): Promise<FileInfo | null> {

    let fileInfo;
    try {
        fileInfo = await file(path).stat();
    } catch {
        return null;
    }

    const isDir = fileInfo.isDirectory();

    if (isDir) {

        const dir: FileInfo = {
            name,
            path,
            isDir,
        };

        if (fileInfo.size) {
            dir.size = fileInfo.size;
        }

        if (fileInfo.mtimeMs) {
            dir.modified = Temporal.Instant.fromEpochMilliseconds(Math.round(fileInfo.mtimeMs)).toString();
        }

        return dir;

    } else {

        return {
            name,
            path,
            isDir,
            size: fileInfo.size,
            modified: Temporal.Instant.fromEpochMilliseconds(Math.round(fileInfo.mtimeMs)).toString(),
        };

    }
}

export async function list(requestedPath: string): Promise<FileInfo[]> {

    const output: FileInfo[] = [];

    try {

        pauseHashing();
        const paths = await readdir(requestedPath);
        const promises = [];

        for (const name of paths) {

            const path = join(requestedPath, name);

            promises.push(getItem(name, path));

        }

        const output = await Promise.all(promises);

        return output.filter(file => file !== null);

    } finally {
        resumeHashing();
    }

}