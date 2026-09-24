import { basename } from 'node:path';
import Release, { type ReleaseState } from './release';
import { tmdb, type TmdbSearchResult } from './tmdb';
import errorString from './util/error-string';
import Files, { type FilesState } from './files';
import Torrent from './torrent';
import Screenshots from './screenshots';
import getMediaInfo, { type MediaInfo } from '$lib/server/mediainfo';
import type { Metadata, TrackerFieldsState, TrackersAfterUploadActionsState, TrackerSearchResults, TrackerSearchResultState, TrackerState, TrackerStatus, TrackerStatusState } from '$lib/types';
import { Trackers } from './trackers';
import { normalize } from './util/normalize';
import { getMalId } from './jikan';
import { log } from './util/log';
import { getReleaseValues as getReleaseEditorValues, releaseFields, releaseFileNameField, setReleaseValue } from './release-fields';
import { cloneMetadata, emptyMetadata, getMetadataValues, setMetadataValue } from './metadata-fields';
import type { Category } from './release-tables';
import settings from './settings';
import { findSeasonOrEpisodeTitle } from './episode-titles';

export interface UploadState {
    errors: string[];
    id: number;
    release: ReleaseState;
    releaseValues: Record<string, string | boolean>;
    releaseBaseline: Record<string, string | boolean>;
    releaseSettled: boolean;
    tmdbResults: TmdbSearchResult[];
    tmdbSelected: Metadata;
    metadataValues: Record<string, string>;
    metadataBaseline: Record<string, string>;
    files: FilesState;
    torrentProgress: number;
    screenshots: string[];
    trackerFields: TrackerFieldsState[];
    trackerData: TrackerState[];
    trackerSearchResults: TrackerSearchResultState[];
    trackerStatus: TrackerStatusState[];
    trackerActions: TrackersAfterUploadActionsState[];
}

export default class Upload {

    id: number;
    private release: Release;
    private tmdbResults?: TmdbSearchResult[];
    private tmdbSelected?: Metadata;
    private tmdbBaseline?: Metadata;
    private updateCallbacks: ((callback: Partial<UploadState>) => void)[] = [];
    private statusUpdateCallbacks: (() => void)[] = [];
    private path: string;
    private files?: Files;
    private torrent?: Torrent;
    private torrentProgress: number = 0;
    private screenshots?: Screenshots;
    private mediaInfo?: ReturnType<typeof getMediaInfo>;
    private mediaInfoFile?: string;
    private trackers?: Trackers;
    private matchedTitles: Map<number, string> = new Map();

    private mediaInfoResult?: MediaInfo;
    private tmdbTitles?: { title: string, originalTitle: string };
    private tmdbSeasonOrEpisodeTitle?: { fileName: string, title: string };
    private releaseBaselineCache?: { key: string, values: Record<string, string | boolean> };

    private initialization: Promise<void>;
    private tmdbSelection = 0;

    private errors: string[] = [];
    private abortController = new AbortController();

    constructor(id: number, path: string) {

        this.id = id;
        this.release = this.buildRelease(basename(path));
        this.path = path;

        this.initialization = this.initialize();
        // Each step has already reported its own error to the UI, this is kept for ready()
        this.initialization.catch(() => {});

    }

    close() {
        this.abortController.abort();
        this.screenshots?.cleanup();
        this.torrent?.stop();
        this.torrent?.cleanup();
        this.trackers?.cleanup();
    }

    checkReleaseSettled() {
        if (!this.mediaInfoResult) throw Error('MediaInfo not ready');
        if (!this.tmdbSelected) throw Error('TMDB not ready');
    }

    emitUpdate(key?: string) {
        for (const callback of this.updateCallbacks) {
            callback(this.toJSON(key));
        }
    }

    /* This is just for Uploads, it should probably have a different name, but
       it doesn't. So there. */
    emitStatusUpdate() {
        for (const callback of this.statusUpdateCallbacks) {
            callback();
        }
    }

    get contentPath() {
        return this.path;
    }

    get name() {
        return this.release.fileName;
    }

    get releaseSettled() {
        return !!this.mediaInfoResult && !!this.tmdbSelected;
    }

    /* For the API, where nobody is watching the UI to pick a TMDB result or a MediaInfo
       file, so waiting on those would never end */
    async ready(signal: AbortSignal) {

        const aborted = AbortSignal.any([this.signal, signal]);
        let onAbort = () => {};
        const abortion = new Promise<never>((_, reject) => {
            onAbort = () => reject(Error(this.signal.aborted ? 'Upload was closed' : 'Request was cancelled'));
            if (aborted.aborted) onAbort();
            else aborted.addEventListener('abort', onAbort, { once: true });
        });

        try {
            await Promise.race([this.initialization, abortion]);
        } catch (error) {
            // The API can reuse an upload, and a step that failed may have been fixed in the UI since
            if (aborted.aborted || !this.releaseSettled) throw error;
        } finally {
            aborted.removeEventListener('abort', onAbort);
        }

        if (!this.mediaInfoResult) throw Error("Couldn't find a video file to read MediaInfo from");
        if (!this.tmdbSelected) throw Error('No TMDB match found, choose one in the UI');

    }

    get signal() {
        return this.abortController.signal;
    }

    get statusCounts() {
        const statuses = this.trackers?.getStatus() ?? [];
        const output: Map<TrackerStatus, number> = new Map();
        for (const status of statuses) {
            const count = output.get(status.status) ?? 0;
            output.set(status.status, count + 1);
        }
        return output;
    }

    getTrackerByName(tracker: string) {
        if (!this.trackers) throw Error('Trackers not initialized');
        return this.trackers.getTrackerByName(tracker);
    }

    getTrackerById(tracker: string) {
        if (!this.trackers) throw Error('Trackers not initialized');
        return this.trackers.getTrackerById(tracker);
    }

    private handleError(description: string, error: any) {
        const message = errorString(description, error);
        this.errors.push(message);
        this.emitUpdate('errors');
    }

    private reportAndRethrow(description: string, error: unknown): never {
        this.handleError(description, error);
        throw error;
    }

    private async initialize() {

        this.initializeTrackers();

        await Promise.all([
            this.initializeTmdb().catch(error => this.reportAndRethrow('Problem with TMDB', error)),
            this.initializeFiles(),
        ]);

    }

    private async initializeFiles() {

        const files = await Files.create(this.path)
            .catch(error => this.reportAndRethrow('Problem initializing upload', error));
        this.files = files;
        this.signal.throwIfAborted();

        const mediaInfoFile = files.mediaInfoFile;
        const mediaInfo = mediaInfoFile
            ? this.loadMediaInfo(mediaInfoFile)
                .catch(error => this.reportAndRethrow(`Couldn't set MediaInfo for ${basename(mediaInfoFile)}`, error))
            : undefined;

        this.initializeScreenshots(files);
        this.initializeTorrent(files.path);

        await mediaInfo;

    }

    private async initializeScreenshots(files: Files) {

        const testFile = files.toJSON()[0];

        if (testFile) {
            this.screenshots = new Screenshots();
            this.screenshots.onChanged(() => this.emitUpdate('screenshots'));
            this.screenshots.onError(error => this.handleError('Problem taking screenshots', error));

            files.onChange(files => {
                const screenshots = this.screenshots?.take(files.map(file => {
                    return { video: file.path, count: file.screenshots };
                }));
                if (screenshots) this.trackers?.setScreenshots(screenshots);
            });

            const screenshots = this.screenshots.take(files.toJSON().map(file => {
                return { video: file.path, count: file.screenshots };
            }));
            if (screenshots) this.trackers?.setScreenshots(screenshots);
        }

    }

    private async initializeTmdb() {

        const match = await this.loadTmdbResult(
            this.release.title,
            this.release.category ?? 'movie',
            this.release.category === 'tv' ? null : this.release.year
        );

        if (match) await this.adoptTmdbResult(match.result.tmdbId, match.name);

    }

    async searchTmdb(query: string, category: Category, year: number | null) {
        const match = await this.loadTmdbResult(query, category, year);
        if (match) await this.selectTmdbResult(match.result.tmdbId, match.name);
    }

    private async loadTmdbResult(query: string, category: Category, year: number | null) {

        const results = category === 'tv'
            ? await tmdb.searchTv(query, year)
            : await tmdb.searchMovie(query, year);

        this.signal.throwIfAborted();

        this.tmdbResults = results.results;
        this.emitUpdate('tmdbResults');

        return results.match;

    }

    private initializeTorrent(path: string) {

        this.torrent = new Torrent(path);
        this.torrent.onProgress((progress) => {
            this.torrentProgress = progress;
            this.emitUpdate('torrentProgress');
        });
        const promise = this.torrent.create();
        this.trackers?.setTorrent(promise);
        promise.catch(reason => { this.handleError('Failed to create torrent', reason); });

    }

    private async initializeTrackers() {
        this.trackers = new Trackers(this.signal);
        this.trackers.onDataChanged(() => this.emitUpdate('trackers'));
        this.trackers.onSearchResults(() => this.emitUpdate('trackerSearchResults'));
        this.trackers.onStatusChanged(() => {
            this.emitUpdate('trackerStatus');
            this.emitStatusUpdate();
        });
        this.trackers.onActionsAdded(() => this.emitUpdate('trackerActions'));
        this.trackers.onError(({ tracker, error }) => {
            this.handleError(`Problem with ${tracker}`, error);
        });
        this.trackers.setRelease(this.release);
    }

    offUpdate(callback: (callback: Partial<UploadState>) => void) {
        this.updateCallbacks = this.updateCallbacks.filter(existingCallback => existingCallback !== callback);
    }

    onStatusUpdate(callback: () => void) {
        this.statusUpdateCallbacks.push(callback);
    }

    onUpdate(callback: (callback: Partial<UploadState>) => void) {
        this.updateCallbacks.push(callback);
    }

    async selectTmdbResult(id: number, matchedTitle?: string) {
        try {
            await this.adoptTmdbResult(id, matchedTitle);
        } catch (error) {
            this.handleError('Problem with TMDB while getting extra metadata', error);
        }
    }

    private async adoptTmdbResult(id: number, matchedTitle?: string) {

        if (!this.tmdbResults) throw Error('No TMDB results returned to select');
        const result = this.tmdbResults.find(result => result.tmdbId === id);
        if (!result) throw Error(`Couldn't select result with TMDB ID ${id}`);

        const selection = ++this.tmdbSelection;
        const hydrated = await tmdb.hydrateResult(result);
        this.signal.throwIfAborted();
        if (selection !== this.tmdbSelection) return;

        await this.adoptMetadata({ ...hydrated, malId: null }, matchedTitle);

    }

    /* Every await here is followed by a check that this is still the selected metadata,
       so a slow earlier selection can't overwrite a newer one */
    private async adoptMetadata(metadata: Metadata, matchedTitle?: string) {

        if (matchedTitle) this.matchedTitles.set(metadata.tmdbId, matchedTitle);
        else {
            const cachedMatch = this.matchedTitles.get(metadata.tmdbId);
            matchedTitle = cachedMatch ?? metadata.title;
        }
        const normalizedMatchedTitle = normalize(matchedTitle);

        const normalizedTitle = normalize(metadata.title);
        let originalTitle = '';

        if (metadata.title !== metadata.originalTitle) {
            const normalizedOriginalTitle = normalize(metadata.originalTitle);
            originalTitle = normalizedMatchedTitle.startsWith(normalizedOriginalTitle) ?
                matchedTitle :
                metadata.originalTitle;
        }

        this.setTmdbTitles({
            title: normalizedMatchedTitle.startsWith(normalizedTitle) ? matchedTitle : metadata.title,
            originalTitle,
        });
        this.release.setCategory(metadata.category);

        this.tmdbSelected = metadata;
        this.tmdbBaseline = cloneMetadata(metadata);
        this.emitUpdate('tmdbSelected');
        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);

        if (metadata.keywords.includes('anime')) {
            try {
                const malId = await getMalId(metadata.title, metadata.originalTitle, this.release.category, metadata.year);
                if (this.tmdbSelected !== metadata) return;
                metadata.malId = malId;
                if (this.tmdbBaseline) this.tmdbBaseline.malId = malId;
                this.emitUpdate('tmdbSelected');
            } catch (error) {
                log(errorString('Getting MAL ID from Jikan failed', error), 'tomato');
            }
        }

        await this.matchSeasonOrEpisodeTitle(metadata);
        this.signal.throwIfAborted();
        if (this.tmdbSelected !== metadata) return;

        // A MediaInfo failure is reported where it happens, trackers just won't become ready
        await this.mediaInfo?.catch(() => {});
        this.signal.throwIfAborted();
        if (this.tmdbSelected !== metadata) return;

        if (this.trackers) {
            this.trackers.setMetadata(metadata);
            this.trackers.search();
        }

    }

    /* Always matched against the title parsed from the filename, so an earlier match or an edit
       can't steer a later one */
    private async matchSeasonOrEpisodeTitle(metadata: Metadata) {

        const fileName = this.release.fileName;
        let title: string | null = null;

        if (metadata.category === 'tv' && metadata.tmdbId) {
            try {
                title = await findSeasonOrEpisodeTitle(
                    new Release(fileName),
                    await tmdb.getSeasons(metadata.tmdbId),
                    seasonNumber => tmdb.getEpisodes(metadata.tmdbId, seasonNumber),
                );
            } catch (error) {
                log(errorString("Couldn't look up the episode title on TMDB", error), 'khaki');
            }
        }

        this.signal.throwIfAborted();
        if (this.tmdbSelected !== metadata || this.release.fileName !== fileName) return;

        this.setTmdbSeasonOrEpisodeTitle(fileName, title);

    }

    private setTmdbSeasonOrEpisodeTitle(fileName: string, title: string | null) {

        const previous = this.release.seasonOrEpisodeTitle;

        this.tmdbSeasonOrEpisodeTitle = title === null ? undefined : { fileName, title };
        this.release.setSeasonOrEpisodeTitle(title ?? new Release(fileName).seasonOrEpisodeTitle ?? '');

        if (this.release.seasonOrEpisodeTitle === previous) return;
        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);

    }

    private setTmdbTitles(titles: { title: string, originalTitle: string }) {
        this.tmdbTitles = titles;
        this.release.setTitle(titles.title);
        this.release.setOriginalTitle(titles.originalTitle);
    }

    private applyMetadataToRelease(metadata: Metadata) {

        if (metadata.title) {
            this.setTmdbTitles({
                title: metadata.title,
                originalTitle: metadata.originalTitle === metadata.title ? '' : metadata.originalTitle,
            });
        }

        this.release.setCategory(metadata.category);

    }

    private seedMetadata(): Metadata {
        const metadata = emptyMetadata();
        metadata.category = this.release.category ?? 'movie';
        metadata.title = this.release.title;
        metadata.originalTitle = this.release.originalTitle ?? this.release.title;
        metadata.year = this.release.year;
        return metadata;
    }

    private materializeMetadata(): Metadata {
        if (!this.tmdbSelected) {
            this.tmdbSelected = this.seedMetadata();
            this.tmdbBaseline = cloneMetadata(this.tmdbSelected);
        }
        return this.tmdbSelected;
    }

    async setMetadataValues(values: Record<string, string | boolean>) {

        const metadata = this.materializeMetadata();
        const selection = ++this.tmdbSelection;

        const previousId = metadata.tmdbId;
        const previousCategory = metadata.category;

        for (const [key, value] of Object.entries(values)) setMetadataValue(metadata, key, value);

        /* The ID and the category together name an entry, so changing either means going back to
           TMDB for it rather than keeping the fields that described the old one */
        if (metadata.tmdbId && (metadata.tmdbId !== previousId || metadata.category !== previousCategory)) {
            await this.adoptTmdbId(metadata.tmdbId, metadata.category, selection);
            return;
        }

        this.applyMetadataToRelease(metadata);

        this.emitUpdate('tmdbSelected');
        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);
        this.trackers?.setMetadata(metadata);

    }

    private async adoptTmdbId(tmdbId: number, category: Category, selection: number) {

        let fetched;

        try {
            fetched = await tmdb.getById(category, tmdbId);
            this.signal.throwIfAborted();
        } catch (error) {
            if (selection !== this.tmdbSelection) return;
            log(errorString(`Couldn't load TMDB ID ${tmdbId}`, error), 'khaki');
            this.clearMetadata(tmdbId, category);
            return;
        }

        if (selection !== this.tmdbSelection) return;

        await this.adoptMetadata({ ...fetched, malId: null });

    }

    private clearMetadata(tmdbId: number, category: Category) {

        const metadata = { ...emptyMetadata(), tmdbId, category };

        this.tmdbSelected = metadata;
        this.tmdbBaseline = cloneMetadata(metadata);
        this.release.setCategory(category);
        this.setTmdbSeasonOrEpisodeTitle(this.release.fileName, null);

        this.emitUpdate('tmdbSelected');
        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);
        this.trackers?.setMetadata(metadata);

    }

    async searchTrackers() {
        if (this.mediaInfo) await this.mediaInfo;
        this.signal.throwIfAborted();
        this.trackers?.search();
    }

    async setMediaInfo(path: string) {
        try {
            await this.loadMediaInfo(path);
        } catch (error) {
            this.handleError(`Couldn't set MediaInfo for ${basename(path)}`, error);
        }
    }

    private async loadMediaInfo(path: string) {

        if (!this.files) throw Error('Files not initialized');
        this.files.checkPath(path);

        if (path === this.mediaInfoFile) return;
        this.mediaInfoFile = path;

        const pending = getMediaInfo(path);
        this.mediaInfo = pending;
        this.trackers?.setMediaInfo(pending);

        let mediaInfo;
        try {
            mediaInfo = await pending;
        } catch (error) {
            // Forget the file so picking it again retries rather than returning early above
            if (this.mediaInfoFile === path) this.mediaInfoFile = undefined;
            throw error;
        }
        this.signal.throwIfAborted();
        if (this.mediaInfoFile !== path) return;

        this.mediaInfoResult = mediaInfo;
        this.release.applyMediaInfo(mediaInfo);

        this.emitUpdate('files');
        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);

    }

    setReleaseValues(values: Record<string, string | boolean>) {

        this.checkReleaseSettled();

        const fileName = values[releaseFileNameField];
        const fileNameChanged = typeof fileName === 'string' && fileName !== this.release.fileName;
        if (fileNameChanged) this.release = this.buildRelease(fileName);

        // Order matters: DV profile turns Dolby Vision on, Atmos codec sets Atmos flag
        const order = releaseFields.map(field => field.id);
        const entries = Object.entries(values)
            .filter(([key]) => key !== releaseFileNameField)
            .sort(([first], [second]) => order.indexOf(first) - order.indexOf(second));

        for (const [key, value] of entries) setReleaseValue(this.release, key, value);

        this.emitUpdate('release');
        this.trackers?.setRelease(this.release);

        if (fileNameChanged && this.tmdbSelected) {
            this.matchSeasonOrEpisodeTitle(this.tmdbSelected)
                .catch(error => this.handleError("Couldn't look up the episode title on TMDB", error));
        }

    }

    private buildRelease(fileName: string) {

        const release = new Release(fileName);

        release.setAnonymous(settings.anonymous);
        release.setPersonalGroup(settings.releaseGroup);

        if (this.mediaInfoResult) release.applyMediaInfo(this.mediaInfoResult);
        if (this.tmdbTitles) {
            release.setTitle(this.tmdbTitles.title);
            release.setOriginalTitle(this.tmdbTitles.originalTitle);
        }
        if (this.tmdbSeasonOrEpisodeTitle?.fileName === fileName) {
            release.setSeasonOrEpisodeTitle(this.tmdbSeasonOrEpisodeTitle.title);
        }

        return release;

    }

    private get releaseBaseline() {

        const key = [
            this.release.fileName, this.mediaInfoFile,
            this.tmdbTitles?.title, this.tmdbTitles?.originalTitle,
            this.tmdbSeasonOrEpisodeTitle?.title,
        ].join('\0');

        if (this.releaseBaselineCache?.key !== key) {
            const values = getReleaseEditorValues(this.buildRelease(this.release.fileName));
            values[releaseFileNameField] = basename(this.path);
            this.releaseBaselineCache = { key, values };
        }

        return this.releaseBaselineCache.values;

    }

    setScreenshotCount(path: string, count: number) {
        if (!this.files) throw Error("Couldn't set screenshots, files not initialized");
        this.files.setScreenshotCount(path, count);
    }

    toJSON(key?: string, sentAsEvent: boolean = true): Partial<UploadState> {

        const output: Partial<UploadState> = {};

        if (!key || key === 'errors') output.errors = this.errors;
        if (!key || key === 'id') output.id = this.id;
        if (!key || key === 'release') {
            output.release = this.release.toJSON();
            output.releaseValues = getReleaseEditorValues(this.release);
            output.releaseBaseline = this.releaseBaseline;
            output.releaseSettled = this.releaseSettled;
        }
        if (!key || key === 'tmdbResults') output.tmdbResults = this.tmdbResults;
        if (!key || key === 'tmdbSelected') output.tmdbSelected = this.tmdbSelected;
        if (!key || key === 'tmdbSelected' || key === 'release') {
            output.metadataValues = getMetadataValues(this.tmdbSelected ?? this.seedMetadata());
            output.metadataBaseline = getMetadataValues(this.tmdbBaseline ?? this.seedMetadata());
        }
        if (!key || key === 'files') output.files = this.files?.toJSON();
        if (!key || key === 'torrentProgress') output.torrentProgress = this.torrentProgress;
        if (!key || key === 'screenshots') output.screenshots = this.screenshots?.toJSON();
        if (!key && !sentAsEvent) output.trackerFields = this.trackers?.getFields();
        if (!key || key === 'trackers') output.trackerData = this.trackers?.getState();
        if (!key || key === 'trackerSearchResults') output.trackerSearchResults = this.trackers?.getSearchResults();
        if (!key || key === 'trackerStatus') output.trackerStatus = this.trackers?.getStatus();
        if (!key || key === 'trackerActions') output.trackerActions = this.trackers?.getActions();

        return output;

    }

}