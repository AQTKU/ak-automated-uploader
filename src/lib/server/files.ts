import { readdir } from 'node:fs/promises';
import { basename, dirname, join, normalize, relative } from 'node:path';
import errorString from './util/error-string';
import { file } from 'bun';

const DEFAULT_SCREENSHOT_COUNT = 6;

interface File {
    name: string;
    path: string;
    screenshots: number;
}

interface FileState extends File {
    mediaInfo: boolean;
}

export type FilesState = FileState[];

export default class Files {

    private directory: string = '';
    private files: File[] = [];
    private changeCallbacks: Array<(callback: FilesState) => void> = [];
    private _path: string = '';
    private firstScreenshotSet = false;
    private _mediaInfoFile: string | undefined;

    private async add(path: string) {

        try {

            path = normalize(path);
            const isDirectory = (await file(path).stat()).isDirectory();

            if (isDirectory) {

                if (!this.directory) {
                    this.directory = path;
                    this._path = path;
                }
                const dir = await readdir(path);
                for (const file of dir) {
                    await this.add(join(path, file));
                }

            } else {

                if (!this.directory) {
                    this.directory = dirname(path);
                    this._path = path;
                }
                await this.addFile(path);

            }

        } catch (error) {
            throw Error(errorString(`Couldn't read ${basename(path)}`, error));
        }

    }

    private async addFile(path: string) {

        path = normalize(path);
        
        this.files.push({
            name: relative(this.directory, path),
            path: path,
            screenshots: this.firstScreenshotSet ? 0 : DEFAULT_SCREENSHOT_COUNT,
        });

        if (!this._mediaInfoFile) this._mediaInfoFile = path;
        this.firstScreenshotSet = true;

    }

    checkPath(path: string) {
        const found = this.files.find(file => file.path === path);
        if (!found) throw Error(`Couldn't find file ${basename(path)}`);
    }

    static async create(path: string): Promise<Files> {
        const files = new Files();
        await files.add(path);
        return files;
    }

    emitChange() {
        for (const callback of this.changeCallbacks) {
            callback(this.toJSON());
        }
    }

    get mediaInfoFile() {
        return this._mediaInfoFile;
    }

    onChange(callback: (callback: FilesState) => void) {
        this.changeCallbacks.push(callback);
    }

    get path() {
        return this._path;
    }

    getName(path: string): string {
        const found = this.files.find(file => file.path === path);
        if (found) return found.name;
        throw Error(`Couldn't find file name from path ${path}`);
    }

    getPath(name: string): string {
        const found = this.files.find(file => file.name === name);
        if (found) return found.path;
        throw Error(`Couldn't find file path from name ${name}`);
    }

    setMediaInfoFile(path: string) {
        const file = this.files.find(file => file.path === path);
        if (!file) throw Error(`Couldn't find file ${basename(path)} to get MediaInfo`);
        this._mediaInfoFile = path;
    }

    setScreenshotCount(path: string, count: number) {
        const file = this.files.find(file => file.path === path);
        if (!file) throw Error(`Couldn't find file ${basename(path)} to set screenshots`)
        file.screenshots = count;
        this.emitChange();
    }

    toJSON(): FilesState {
        return this.files.map(file => Object.assign(
            file, { mediaInfo: file.path === this._mediaInfoFile }
        ));
    }

}