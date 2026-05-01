import type getMediaInfo from '$lib/server/mediainfo';
import { file } from 'bun';
import type Release from './release';
import type Torrent from './torrent';
import errorString from './util/error-string';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { FieldsToType, TrackerField, TrackerSearchResults, TrackerSettings, TrackerFieldState, Image, TrackerStatus, TrackerAfterUploadAction, TrackerAfterUploadActionState, Metadata, TrackerLayout } from '$lib/types';
import { Context, Liquid, TagToken, type Emitter, type TopLevelToken } from 'liquidjs';
import { uploadScreenshots } from './upload-screenshots';
import { log } from './util/log';
import sendTorrent from './send-torrent';

export default abstract class Tracker {

    abstract name: string;
    private actions: TrackerAfterUploadAction[] = [];
    private actionsAddedCallbacks: Array<(data: TrackerAfterUploadActionState[]) => void> = [];
    allowedImageHosts: string[] | undefined = undefined;
    announce?: string;
    abstract data: FieldsToType<typeof this.fields>;
    private dataChangedCallbacks: Array<(data: Record<string, string | boolean>) => void> = [];
    private errorCallbacks: Array<(reason: string) => void> = [];
    errors: string[] = [];
    abstract readonly fields: TrackerField[];
    abstract readonly layout: TrackerLayout;
    imageHosts: string[] = [];
    metadata?: Metadata;
    mediaInfo?: ReturnType<typeof getMediaInfo>;
    release?: Release;
    screenshots?: Promise<string[]>;
    signal?: AbortSignal;
    status: TrackerStatus = ''
    statusCallbacks: Array<(status: TrackerStatus) => void> = [];
    abstract source: string;
    torrentPromise?: Promise<Torrent>;
    torrent?: { path: string; blob: Blob; filename: string };
    torrentPaths: string[] = [];
    
    constructor(settings: TrackerSettings) {
        this.configure(settings);
    }

    protected abstract applyMetadata(metadata: Metadata): void;

    protected abstract applyRelease(release: Release): void;

    async cleanup() {
        if (this.torrent) {
            try { await file(this.torrent.path).delete(); } catch { }
        }
        for (const path of this.torrentPaths) {
            try { await file(path).delete(); } catch { }
        }
    }

    configure(settings: TrackerSettings) {
        this.name = settings.name;
        this.announce = settings.announce;
        this.imageHosts = settings.imageHosts;
    }

    emitActions() {
        for (const callback of this.actionsAddedCallbacks) {
            callback(this.getActionState());
        }
    }

    emitDataChanged() {
        for (const callback of this.dataChangedCallbacks) {
            callback(this.getDataState());
        }
    }

    emitError(error: string) {
        this.errors.push(error);
        for (const callback of this.errorCallbacks) {
            callback(error);
        }
        this.emitStatus('❌ Error');
    }

    emitStatus(status: TrackerStatus) {
        this.status = status;
        for (const callback of this.statusCallbacks) {
            callback(status);
        }
    }

    getActionState(): TrackerAfterUploadActionState[] {
        return this.actions.map((action, index) => ({
            id: index,
            label: action.label
        }));
    }

    async getAfterUploadActions(signal: AbortSignal): Promise<TrackerAfterUploadAction[]> { return []; };

    getDataState() {

        const output: Record<string, string | boolean> = {};

        for (const key in this.data) {
            if (typeof this.data[key] !== 'string' && typeof this.data[key] !== 'boolean') {
                throw Error(`Tried to get data state and received the wrong type: ${typeof this.data[key]}`);
            }
            output[key] = this.data[key];
        }

        return output;

    }

    getErrorState() {
        return this.errors;
    }

    getFieldState() {
        const output: TrackerFieldState[] = [];

        for (const field of this.fields) {

            if (field.type === 'select') {

                output.push({
                    id: field.key,
                    label: field.label,
                    type: 'select',
                    options: field.options.map(item => ({ id: item[0], label: item[1] })),
                    size: field.size,
                });

            } else if (field.type === 'checkbox') {

                output.push({
                    id: field.key,
                    label: field.label,
                    type: 'checkbox',
                });

            } else {

                output.push({
                    id: field.key,
                    label: field.label,
                    type: field.type,
                    size: field.size,
                });

            }

        }

        return output;

    }

    getStatusState() {
        return this.status;
    }

    getOption(fieldKey: string) {
        if (!this.data[fieldKey]) throw Error(`Couldn't get the key for field ${fieldKey}, data not found`);
        const field = this.fields.find(field => field.key === fieldKey);
        if (!field) throw Error(`Couldn't get the key for field ${fieldKey}, field not found`);
        if (field.type !== 'select') throw Error(`Couldn't get the key for field ${fieldKey}, field type isn't select`);
        const option = field.options.find(option => option[0] === this.data[fieldKey]);
        if (!option) throw Error(`Couldn't get the key for field ${fieldKey}, ${this.data[fieldKey]} not found in field`);
        return option[1];
    }

    async makeTorrent() {

        if (!this.torrentPromise) throw Error(`No torrent available to edit for ${this.name}`);
        if (!this.announce) throw Error(`Announce URL not configured for ${this.name}`);

        const torrent = await this.torrentPromise;
        this.signal?.throwIfAborted();
        const editedTorrentFilename = await torrent.edit(this.announce, this.source);
        this.signal?.throwIfAborted();

        return editedTorrentFilename;

    }

    onActionAdded(callback: (actions: TrackerAfterUploadActionState[]) => void) {
        this.actionsAddedCallbacks.push(callback);
    }

    onDataChanged(callback: (data: Record<string, string | boolean>) => void) {
        this.dataChangedCallbacks.push(callback);
    }

    onError(callback: (reason: string) => void) {
        this.errorCallbacks.push(callback);
    }

    onStatusChanged(callback: (status: TrackerStatus) => void) {
        this.statusCallbacks.push(callback);
    }

    async performAction(id: number) {
        if (!this.actions[id]) throw Error(`Couldn't find action`);
        await this.actions[id]!.action();
    }

    abstract search(): Promise<TrackerSearchResults>;

    set(key: string, value: string | boolean, emit = true) {

        const field = this.fields.find(field => field.key === key);
        if (!field) throw Error(`Couldn't find field ${key}`);

        if (field.type === 'checkbox') {
            if (typeof value !== 'boolean') throw Error(`Couldn't set ${key}, expected boolean, got string`);
            this.data[key] = value;
            return;
        }

        if (typeof value !== 'string') throw Error(`Couldn't set ${key}, expected string, got boolean`);

        if (field.type === 'select') {
            const keys = field.options.map(option => option[0]);
            if (!keys.includes(value)) throw Error(`Couldn't set ${key}, must be one of: ${keys.join(', ')}`);
        }

        this.data[key] = value;

        if (emit) this.emitDataChanged();

    }

    setData(data: Record<string, string | boolean>) {

        for (const field of this.fields) {

            if (field.type === 'checkbox') {
                this.set(field.key, data[field.key] === '1', false);
            } else {
                this.set(field.key, data[field.key] ?? field.default, false);
            }

        }
        
        this.emitDataChanged();

    }

    setDefaults<T extends readonly TrackerField[]>(
        fields: T
    ): FieldsToType<T> {
        return Object.fromEntries(
            fields.map(field => {
                if (field.type === 'select') {
                    const option = field.options.find(option => option[1] === field.default);
                    if (!option) throw Error(`Couldn't find default option for ${field.key} on ${this.name}`);
                    return [field.key, option[0]];
                }
                return [field.key, field.default];
            })
        ) as FieldsToType<T>;
    }

    setMediaInfo(mediaInfo: ReturnType<typeof getMediaInfo>) {
        this.mediaInfo = mediaInfo;
        this.emitStatus('⏳ Waiting for MediaInfo and metadata');
        this.mediaInfo.then(() => {
            if (this.metadata) this.emitStatus('✏️ Ready to edit');
        });
    }

    setMetadata(metadata: Metadata) {
        this.metadata = metadata;
        this.applyMetadata(metadata);
        this.mediaInfo?.then(
            () => this.emitStatus('✏️ Ready to edit'),
            () => {}
        );
        this.emitDataChanged();
    }

    setRelease(release: Release) {
        this.release = release;
        this.applyRelease(release);
        this.emitDataChanged();
    }

    setOption(fieldKey: string, value: string) {
        if (this.data[fieldKey] === undefined) throw Error(`Couldn't get the key for field ${fieldKey}, data not found`);
        const field = this.fields.find(field => field.key === fieldKey);
        if (!field) throw Error(`Couldn't get the key for field ${fieldKey}, field not found`);
        if (field.type !== 'select') throw Error(`Couldn't get the key for field ${fieldKey}, field type isn't select`);
        const option = field.options.find(option => option[1] === value);
        if (!option) throw Error(`Couldn't get the key for field ${fieldKey}, ${value} not found in field`);
        this.data[fieldKey] = option[0];
    }

    setScreenshots(screenshots: Promise<string[]>) {
        this.screenshots = screenshots;
    }

    setSignal(signal: AbortSignal) {
        this.signal = signal;
    }

    setTorrent(torrent: Promise<Torrent>) {
        this.torrentPromise = torrent;
    }

    async submit() {

        let torrentPath;

        try {

            this.emitStatus('🚦 Checking release');

            if (!this.announce) throw Error('Announce URL not set');
            if (!this.torrentPromise) throw Error('Torrent not set');
            if (!this.signal) throw Error('Parent upload not set');
            await this.validate();

            const signal = this.signal;

            this.emitStatus('🧲 Making torrent');

            const torrent = await this.torrentPromise;
            signal.throwIfAborted();
            torrentPath = await torrent.edit(this.announce, this.source);
            signal.throwIfAborted();
            this.torrentPaths.push(torrentPath);
            const editedTorrent = file(torrentPath);
            const editedTorrentFilename = basename(torrentPath);

            log(`Uploading ${basename(this.release?.fileName ?? 'torrent')} to ${this.name}`);
            this.emitStatus('⬆️ Uploading torrent');

            const download = await this.upload(editedTorrent, editedTorrentFilename, signal);
            signal.throwIfAborted();

            if (download) {

                log(`Downloading updated torrent file from ${this.name}`);
                this.emitStatus('⬇️ Downloading updated torrent');

                let response;
                if (download instanceof Response) response = download;
                else response = await fetch(download, { signal });

                const arrayBuffer = await response.arrayBuffer();
                const path = join(tmpdir(), randomUUID() + '.torrent');
                await file(path).write(arrayBuffer);
                signal.throwIfAborted();
                torrentPath = path;
                this.torrentPaths.push(path);

            }

            this.emitStatus('📤 Sending torrent to client');

            await sendTorrent(torrentPath, torrent.contentPath, signal);
            signal.throwIfAborted();

            try {
                this.emitStatus('🎯 Checking for more options');
                this.actions = await this.getAfterUploadActions(signal);
                this.emitActions();
            } catch (error) {
                log(errorString(`Error while checking for more options`, error), 'tomato');
            }

            log(`Uploaded ${basename(this.release?.fileName ?? 'torrent')} to ${this.name}`, 'aquamarine');
            this.emitStatus('✅ Done');

        } catch (error) {
            const status = this.status;
            this.emitError(errorString(`${status} failed`, error));
            throw Error(errorString(`${status} failed`, error));
        }

    }

    async transformTags() {

        try {

            if (!this.mediaInfo) throw Error("MediaInfo hasn't been set");
            if (!this.release) throw Error("Release hasn't been set");
            if (!this.screenshots) throw Error("Screenshots haven't been set");
            if (!this.signal) throw Error("Abort signal hasn't been set");

            const screenshotPaths = await this.screenshots;
            const imageHostOrder = this.imageHosts;
            const signal = this.signal;
            const tracker = this;

            const engine = new Liquid();

            engine.registerTag('screenshots', {

                parse(token: TagToken, remainingTokens: TopLevelToken[]) {

                    this.args = {};
                    const matches = token.args.matchAll(/(\w+):(\S+)/g);
                    for (const match of matches) {
                        const [, key, value] = match;
                        if (key) this.args[key] = value;
                    }

                    this.templates = [];
                    const stream = this.liquid.parser.parseStream(remainingTokens);
                    stream.on('tag:endscreenshots', () => stream.stop());
                    stream.on('template', (tpl: TopLevelToken) => this.templates.push(tpl));
                    stream.on('end', () => {
                        throw Error('{% screenshots %} not closed with {% endscreenshots %}')
                    });
                    stream.start();

                },

                *render(ctx: Context, emitter: Emitter): Generator<unknown, any, unknown> {

                    const width = this.args.width ? parseInt(this.args.width) : undefined;
                    const limit = this.args.limit ? parseInt(this.args.limit) : undefined;

                    tracker.emitStatus('🖼️ Uploading screenshots');

                    const results = yield uploadScreenshots({
                        paths: screenshotPaths,
                        imageHostOrder: imageHostOrder,
                        thumbnailWidth: width,
                        allowedImageHosts: tracker.allowedImageHosts,
                        limit,
                        signal,
                    });

                    for (const item of results as Image[]) {
                        ctx.push({
                            page: item.page,
                            image: item.image,
                            thumbnail: item.thumbnail,
                        });
                        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
                        ctx.pop();
                    }
                
                }

            });

            const context = {
                field: this.data,
                mediaInfo: await this.mediaInfo,
                metadata: this.metadata ?? {},
                release: this.release.toJSON(),
            };

            const textFields = this.fields.filter(field => ['text', 'multiline'].includes(field.type));

            for (const field of textFields) {

                if (!(field.key in this.data)) continue;
                const value = this.data[field.key];
                if (typeof value !== 'string') continue;

                this.data[field.key] = await engine.parseAndRender(value, context);

            }

            this.emitStatus('📋 Preview done');
            this.emitDataChanged();

        } catch (error) {
            this.emitStatus('❌ Error');
            this.emitError(errorString("Couldn't transform tags", error));
            throw Error(errorString("Couldn't transform tags", error));
        }

    }

    protected abstract upload(torrent: Blob, torrentFilename: string, signal: AbortSignal): Promise<void | string | Response>;

    async validate(): Promise<void> { }

}