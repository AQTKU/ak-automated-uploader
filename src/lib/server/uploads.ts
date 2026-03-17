import type { UploadsState } from '$lib/types';
import Upload from './upload';

class Uploads {

    private uploads = new Map<number, Upload>();
    private nextId = 1;
    private updateCallbacks: Array<(uploadsState: UploadsState) => void> = [];

    create(path: string): number {
        const id = this.nextId++;
        const upload = new Upload(id, path);
        upload.onStatusUpdate(() => this.emitUpdate());
        this.uploads.set(id, upload);
        return id;
    }

    delete(id: number) {
        const upload = this.get(id);
        if (!upload) throw Error(`Upload ${id} not found`);
        upload.close();
        this.uploads.delete(id);
        this.emitUpdate();
    }

    get(id: number) {
        return this.uploads.get(id);
    }

    emitUpdate() {
        for (const callback of this.updateCallbacks) {
            callback(this.toJSON());
        }
    }

    offUpdate(callback: (uploadsState: UploadsState) => void) {
        this.updateCallbacks = this.updateCallbacks.filter(existingCallback => existingCallback !== callback);
    }

    onUpdate(callback: (uploadsState: UploadsState) => void) {
        this.updateCallbacks.push(callback);
    }

    remove(id: number) {
        this.uploads.delete(id);
    }

    toJSON(): UploadsState {

        const output = [];

        for (const [id, upload] of this.uploads) {
            output.push({
                id,
                name: upload.name,
                statusCounts: Object.fromEntries(upload.statusCounts) as Record<string, number>
            })
        }

        return output;

    }

}

export const uploads = new Uploads();