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

export async function list(requestedPath: string): Promise<FileInfo[]> {

    const output: FileInfo[] = [];

    try {

        pauseHashing();
        const paths = await readdir(requestedPath);

        for (const name of paths) {

            const path = join(requestedPath, name);
            let fileInfo;
            try {
                fileInfo = await file(path).stat();
            } catch {
                continue;
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
                    dir.modified = Temporal.Instant.fromEpochMilliseconds(fileInfo.mtimeMs).toString();
                }

                output.push(dir);

            } else {

                output.push({
                    name,
                    path,
                    isDir,
                    size: fileInfo.size,
                    modified: Temporal.Instant.fromEpochMilliseconds(fileInfo.mtimeMs).toString(),
                });

            }

        }

        return output;

    } finally {
        resumeHashing();
    }

}