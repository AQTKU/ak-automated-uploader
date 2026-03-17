import { file, spawn } from 'bun';
import { basename, join } from 'node:path';
import z from 'zod';
import errorString from './util/error-string';
import PQueue from 'p-queue';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pauseHashing, resumeHashing } from './torrent';
import { log } from './util/log';

const RETAKE_THRESHOLD = 80 * 1024;
const RETAKE_ATTEMPTS = 5;

let ffprobePath = 'ffprobe';
let ffmpegPath = 'ffmpeg';
const queue = new PQueue({ concurrency: 1 });
const allScreenshots: Screenshots[] = [];

export default class Screenshots {

    private error: Error | undefined = undefined;
    private errorCallbacks: Array<(error: Error) => void> = [];
    private changedCallbacks: Array<(uuids: string[]) => void> = [];
    private currentBatch: Promise<string[]> | undefined = undefined;
    private uuids: string[] = [];
    private batches: Promise<string[]>[] = [];
    private cache = new Map<string, string>();

    constructor() {
        allScreenshots.push(this);
    }

    private async calculateTimestamps(video: string, count: number) {
    
        const duration = await this.getDuration(video);
        const timestamps: number[] = [];

        for (let i = 0; i < count; i++) {
            timestamps.push(Math.round(duration / (count + 1) * (i + 1)));
        }

        return timestamps;

    }

    async cleanup() {

        const batches = await Promise.all(this.batches);
        for (const batch of batches) {
            for (const uuid of batch) {
                this.remove(uuid);
            }
        }
        this.cache.clear();

    }

    async getDuration(video: string) {

        const schema = z.object({
            format: z.object({
                duration: z.string().transform(
                    duration => Math.round(parseFloat(duration) * 1000)
                ),
            }),
        });

        let validated;

        try {

            const data = await this.ffprobe(
                '-select_streams', 'v:0',
                '-show_entries', 'format=duration',
                video
            );
            validated = schema.parse(data);

        } catch {

            try {

                const data = await this.ffprobe(
                    '-show_entries', 'format=duration',
                    video
                );
                validated = schema.parse(data);

            } catch (error) {
                throw Error(errorString(`Couldn't get duration of ${basename(video)}`, error));
            }

        }

        const duration = validated.format.duration;

        if (duration <= 0) throw Error(`Couldn't get duration of ${basename(video)}, ffprobe returned ${duration}`);

        return duration;

    }

    private emitError(error: Error) {
        for (const callback of this.errorCallbacks) {
            callback(error);
        }
    }

    private emitChanged() {
        for (const callback of this.changedCallbacks) {
            callback(this.uuids);
        }
    }

    private async ffmpeg(...options: string[]) {

        const ffmpeg = spawn([ffmpegPath, ...options], { stderr: 'ignore' });
        const decoder = new TextDecoder();
        let output = '';

        for await (const chunk of ffmpeg.stdout) {
            output += decoder.decode(chunk);
        }

        const code = await ffmpeg.exited;
        if (code !== 0) throw Error(`ffmpeg exited with code ${code} while trying ${options.join(' ')}`);

        return output;

    }

    private async ffprobe(...options: string[]) {

        options = [
            ffprobePath,
            '-v', 'error',
            '-output_format', 'json',
            ...options
        ];

        const ffprobe = spawn(options);
        const decoder = new TextDecoder();
        let output = '';

        for await (const chunk of ffprobe.stdout) {
            output += decoder.decode(chunk);
        }

        const code = await ffprobe.exited;
        if (code !== 0) throw Error(`ffprobe exited with code ${code} while trying ${options.join(' ')}`);

        return JSON.parse(output);

    }

    private async generateBatch(requests: Array<{ video: string, count: number }>): Promise<string[]> {

        await this.currentBatch;

        this.error = undefined;
        this.uuids = [];
        this.emitChanged();

        try {

            for (const { video, count } of requests) {

                log(`Taking ${count} screenshots of ${basename(video)}`);

                await this.isVideo(video);

                const timestamps = await this.calculateTimestamps(video, count);

                for (const timestamp of timestamps) {

                    const key = `${video}.${timestamp}`;
                    let uuid = this.cache.get(key);

                    if (!uuid) {
                        uuid = await this.takeOne(video, timestamp);
                        this.cache.set(key, uuid);
                    }

                    this.uuids.push(uuid);
                    this.emitChanged();

                }

            }

        } catch (error) {
            this.error = Error(errorString("Couldn't generate screenshots", error));
            this.emitError(this.error);
        }

        log(`Took ${this.uuids.length} screenshots`, 'aquamarine');

        return this.uuids;

    }

    static getPath(id: string) {
        for (const screenshots of allScreenshots) {
            if (screenshots.isValidId(id)) {
                return screenshots.uuidToFilename(id);
            }
        }
        throw Error(`Couldn't find path for ID ${id}`);
    }

    async getPaths(): Promise<string[]> {
        if (!this.currentBatch) {
            return [];
        }
        const screenshots = await this.currentBatch;
        const paths = screenshots.map(uuid => this.uuidToFilename(uuid));
        return paths;
    }

    isValidId(id: string) {
        return Boolean(this.uuids.find(uuid => uuid === id));
    }

    private async isVideo(path: string) {

        const data = await this.ffprobe(
            '-select_streams', 'v',
            '-show_entries', 'stream=index',
            path
        );

        const schema = z.object({
            streams: z.array(z.object({
                index: z.number(`Couldn't find video stream in ${basename(path)}`),
            })).min(1, `Couldn't find video stream in ${basename(path)}`),
        });

        schema.parse(data);

    }

    onError(callback: (error: Error) => void) {
        this.errorCallbacks.push(callback);
    }

    onChanged(callback: (id: string[]) => void) {
        this.changedCallbacks.push(callback);
    }

    remove(idToRemove: string) {
        if (this.uuids.includes(idToRemove)) {

            this.uuids = this.uuids.filter(uuid => uuid !== idToRemove);
            this.emitChanged();

            file(this.uuidToFilename(idToRemove)).delete().then(() => {}).catch(() => {});
            for (const [key, uuid] of this.cache.entries()) {
                if (idToRemove === uuid) {
                    this.cache.delete(key);
                }
            }

        }
    }

    async take(requests: Array<{ video: string, count: number }>) {

        let paths;

        try {
            pauseHashing();
            const promise = this.generateBatch(requests);
            this.currentBatch = promise;
            this.batches.push(promise);
            const ids = await promise;
            paths = ids.map(id => this.uuidToFilename(id));
        } catch (error) {
            throw Error(errorString('Problem generating screenshots', error));
        } finally {
            resumeHashing();
        }

        return paths;

    }

    private async takeOne(video: string, timestamp: number) {

        return await queue.add(async () => {

            try {

                const uuid = randomUUID();
                const outputPath = this.uuidToFilename(uuid);

                for (let attempt = 0; attempt < RETAKE_ATTEMPTS; attempt++) {

                    await this.ffmpeg(
                        '-y',
                        '-ss', String(timestamp / 1000),
                        '-i', video,
                        '-vf', "scale='max(iw,iw*sar)':'max(ih,ih/sar)'",
                        '-frames:v', '1',
                        outputPath
                    );

                    const size = (await file(outputPath).stat()).size;
                    if (size > RETAKE_THRESHOLD) break;

                    timestamp += 2000;

                }

                return uuid;

            } catch (error) {
                throw Error(errorString(`Problem generating screenshot for ${basename(video)}`, error));
            }

        });

    }

    toJSON() {
        return this.uuids;
    }

    private uuidToFilename(uuid: string) {
        return join(tmpdir(), uuid + '.png');
    }

}