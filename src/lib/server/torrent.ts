import { file, spawn, type ReadableSubprocess } from 'bun';
import { dlopen, FFIType } from 'bun:ffi';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import PQueue from 'p-queue';
import errorString from './util/error-string';
import { log } from './util/log';

/* Platform-specific suspend/resume
   mkbrr hits the disk really hard, so we'll pause it whenever we need it for
   something else. I don't really know how it works, Claude wrote it lol. */

interface ProcessController {
    suspend(pid: number): void;
    resume(pid: number): void;
}

function createWindowsProcessController(): ProcessController {
    // Minimum access right needed for NtSuspendProcess/NtResumeProcess.
    const PROCESS_SUSPEND_RESUME = 0x0800;

    const { symbols: kernel32 } = dlopen('kernel32', {
        OpenProcess: {
            args: [FFIType.u32, FFIType.bool, FFIType.u32],
            returns: FFIType.ptr,
        },
        CloseHandle: {
            args: [FFIType.ptr],
            returns: FFIType.bool,
        },
    });

    /* NtSuspendProcess and NtResumeProcess are undocumented APIs that will
       probably exist forever because Microsoft is Microsoft. */
    
    const { symbols: ntdll } = dlopen('ntdll', {
        NtSuspendProcess: {
            args: [FFIType.ptr],
            returns: FFIType.i32
        },
        NtResumeProcess: {
            args: [FFIType.ptr],
            returns: FFIType.i32,
        },
    });

    function withProcessHandle(pid: number, action: (handle: Parameters<typeof ntdll.NtSuspendProcess>[0]) => void) {
        const handle = kernel32.OpenProcess(PROCESS_SUSPEND_RESUME, false, pid);
        if (!handle) throw Error(`Failed to open handle for process ${pid}`);
        try {
            action(handle);
        } finally {
            kernel32.CloseHandle(handle);
        }
    }

    return {
        suspend(pid: number) {
            withProcessHandle(pid, handle => {
                const result = ntdll.NtSuspendProcess(handle);
                if (result < 0) console.warn('Failed to suspend hashing');
                return result;
            });
        },
        resume(pid: number) {
            withProcessHandle(pid, handle => {
                const result = ntdll.NtResumeProcess(handle);
                if (result < 0) console.warn('Failed to resume hashing');
                return result;
            });
        },
    }

}

function createUnixProcessController(): ProcessController {
    return {
        suspend(pid: number) { process.kill(pid, 'SIGSTOP'); },
        resume(pid: number) { process.kill(pid, 'SIGCONT'); },
    }
}

let processController: ProcessController | undefined;

function getProcessController(): ProcessController {
    if (!processController) {
        processController = process.platform === 'win32' ?
            createWindowsProcessController() :
            createUnixProcessController();
    }
    return processController;
}

const hashingTorrents = new Set<Torrent>();
let pausers = 0;

export function pauseHashing() {
    pausers++;
    if (pausers === 1) {
        for (const torrent of hashingTorrents) {
            torrent.pause();
        }
    }
}

export function resumeHashing() {
    pausers--;
    if (pausers <= 0) {
        pausers = 0;
        for (const torrent of hashingTorrents) {
            torrent.resume();
        }
    }
}

const queue = new PQueue({ concurrency: 1 });

export default class Torrent {

    private hashPromise: Promise<Torrent> | undefined = undefined;
    private _contentPath: string;
    private mkbrr: ReadableSubprocess | undefined = undefined;
    private torrentPath: string;
    private editedTorrentPaths: string[] = [];
    private progressCallbacks: Array<(progress: number) => void> = [];

    constructor(path: string) {
        this._contentPath = path;
        this.torrentPath = join(tmpdir(), randomUUID() + '.torrent');
    }

    async cleanup() {
        try { await file(this.torrentPath).delete(); } catch { }
        for (const editedTorrentPath of this.editedTorrentPaths) {
            try { await file(editedTorrentPath).delete(); } catch { }
        }
    }

    async create() {

        if (this.hashPromise) return this.hashPromise;

        this.hashPromise = queue.add(async () => {

            log(`Starting hashing for ${basename(this._contentPath)}`);

            this.mkbrr = spawn([
                'mkbrr',
                'create', this._contentPath,
                '--output', this.torrentPath,
                '--private',
            ]);

            hashingTorrents.add(this);
            if (pausers > 0) this.pause();

            const decoder = new TextDecoder();

            try {

                for await (const chunk of this.mkbrr.stdout) {
                    const text = decoder.decode(chunk);
                    const lines = text.split('\n');

                    for (const line of lines) {
                        const match = line.match(/Hashing pieces.+?(\d+)%/);
                        if (match && match[1]) this.emitProgress(parseInt(match[1]));
                    }
                }

                const code = await this.mkbrr.exited;
                if (code !== 0) throw Error(`Torrent creation for ${basename(this._contentPath)} failed with code ${code}`);
                if (!(await file(this.torrentPath).exists())) throw Error(`Torrent creation for ${basename(this._contentPath)} failed`)

            } finally {
                this.mkbrr = undefined;
                hashingTorrents.delete(this);
            }

            log(`Finished hashing for ${basename(this._contentPath)}`, 'aquamarine');

            return this;

        });

        return this.hashPromise;

    }

    async edit(announce: string, source: string): Promise<string> {

        await this.create();

        const editedTorrentPath = queue.add(async () => {

            const editedTorrentPath = join(tmpdir(), randomUUID() + '.torrent');
            this.editedTorrentPaths.push(editedTorrentPath);

            let code;

            try {

                pauseHashing();

                const mkbrr = spawn([
                    'mkbrr', 'modify',
                    '--output-dir', dirname(editedTorrentPath),
                    '--output', basename(editedTorrentPath, '.torrent'),
                    '--tracker', announce,
                    '--source', source,
                    '--private',
                    this.torrentPath,
                ]);

                const code = await mkbrr.exited;
                if (code !== 0) throw Error(`mkbrr exited with code ${code}`);
                if (!(await file(editedTorrentPath).exists())) throw Error("Edited file doesn't exist");

            } catch (error) {
                throw Error(errorString(`Torrent editing for ${source} failed`, error));
            } finally {
                resumeHashing();
            }

            return editedTorrentPath;

        });

        return editedTorrentPath;

    }

    get contentPath() { return this._contentPath; }

    pause() {
        if (this.mkbrr?.pid !== undefined) {
            getProcessController().suspend(this.mkbrr.pid);
        }
    }

    resume() {
        if (this.mkbrr?.pid !== undefined) {
            getProcessController().resume(this.mkbrr.pid);
        }
    }

    private emitProgress(progress: number) {
        for (const callback of this.progressCallbacks) {
            callback(progress);
        }
    }

    onProgress(callback: (progress: number) => void) {
        this.progressCallbacks.push(callback);
    }

    stop() {
        if (this.mkbrr) this.mkbrr.kill();
    }

}