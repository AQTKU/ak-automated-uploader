import { basename } from 'node:path';
import Release, { type ReleaseState } from './release';
import { tmdb, type TmdbSearchResult } from './tmdb';
import errorString from './util/error-string';
import Files, { type FilesState } from './files';
import Torrent from './torrent';
import Screenshots from './screenshots';
import getMediaInfo from '$lib/server/mediainfo';
import type { TmdbHydratedSearchResult, TrackerFieldsState, TrackersAfterUploadActionsState, TrackerSearchResults, TrackerSearchResultState, TrackerState, TrackerStatus, TrackerStatusState } from '$lib/types';
import { Trackers } from './trackers';
import { normalize } from './util/normalize';
import { getMalId } from './jikan';
import { log } from './util/log';

export interface UploadState {
    errors: string[];
    id: number;
    release: ReleaseState;
    tmdbResults: TmdbSearchResult[];
    tmdbSelected: TmdbHydratedSearchResult;
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
    private tmdbSelected?: TmdbHydratedSearchResult;
    private updateCallbacks: ((callback: Partial<UploadState>) => void)[] = [];
    private statusUpdateCallbacks: (() => void)[] = [];
    private errorCallbacks: ((error: string) => void)[] = [];
    private path: string;
    private files?: Files;
    private torrent?: Torrent;
    private torrentProgress: number = 0;
    private screenshots?: Screenshots;
    private mediaInfo?: ReturnType<typeof getMediaInfo>;
    private mediaInfoFile?: string;
    private trackers?: Trackers;
    private matchedTitles: Map<number, string> = new Map();
    private initializationPromise: Promise<void> | null = null;

    private errors: string[] = [];
    private abortController = new AbortController();

    constructor(id: number, path: string) {

        this.id = id;
        this.release = new Release(basename(path));
        this.path = path;

        this.initialize().then(() => { }, error => this.handleError('Problem initializing upload', error));

    }

    close() {
        this.abortController.abort();
        this.screenshots?.cleanup();
        this.torrent?.stop();
        this.torrent?.cleanup();
        this.trackers?.cleanup();
    }

    emitError(error: string) {
        for (const callback of this.errorCallbacks) {
            callback(error);
        }
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

    get name() {
        return this.release.fileName;
    }

    get readyToEdit(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.onStatusUpdate(() => {
                const statusCounts = this.statusCounts.get('✏️ Ready to edit');
                if ((statusCounts || 0) >= (this.trackers?.count || Infinity)) resolve();
            });
            this.onError((message) => reject(message));
        });
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
        this.emitError(message);
    }

    private async initialize() {

        this.initializeTrackers();
        this.initializeTmdb();

        this.files = await Files.create(this.path);
        this.signal.throwIfAborted();
        if (this.files.mediaInfoFile) this.setMediaInfo(this.files.mediaInfoFile);
        this.initializeScreenshots(this.files);
        this.initializeTorrent(this.files.path);

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

        try {

            const results = this.release.category == 'tv'
                ? await tmdb.searchTv(this.release.title)
                : await tmdb.searchMovie(this.release.title, this.release.year);

            this.signal.throwIfAborted();

            this.tmdbResults = results.results;
            this.emitUpdate('tmdbResults');

            if (results.match) {
                await this.selectTmdbResult(results.match.result.tmdbId, results.match.name);
                this.signal.throwIfAborted();
            }


        } catch (error) {
            this.errors.push(errorString('Problem with TMDB', error));
            this.emitUpdate('errors');
        }

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
        this.trackers.onError(() => {
            for (const errorState of this.trackers?.getErrorState() || []) {
                this.handleError(`Problem with ${errorState.tracker}`, errorState.errors.join('; '));
            }
        });
        this.trackers.setRelease(this.release);
    }

    offUpdate(callback: (callback: Partial<UploadState>) => void) {
        this.updateCallbacks = this.updateCallbacks.filter(existingCallback => existingCallback !== callback);
    }

    onError(callback: (error: string) => void) {
        this.errorCallbacks.push(callback);
    }

    onStatusUpdate(callback: () => void) {
        this.statusUpdateCallbacks.push(callback);
    }

    onUpdate(callback: (callback: Partial<UploadState>) => void) {
        this.updateCallbacks.push(callback);
    }

    async selectTmdbResult(id: number, matchedTitle?: string) {

        try {

            if (!this.tmdbResults) throw Error('No TMDB results returned to select');
            const result = this.tmdbResults.find(result => result.tmdbId === id);
            if (!result) throw Error(`Couldn't select result with TMDB ID ${id}`);

            const hydrated = await tmdb.hydrateResult(result);
            this.signal.throwIfAborted();

            if (matchedTitle) this.matchedTitles.set(hydrated.tmdbId, matchedTitle);
            else {
                const cachedMatch = this.matchedTitles.get(hydrated.tmdbId);
                matchedTitle = cachedMatch ?? hydrated.title;
            }
            const normalizedMatchedTitle = normalize(matchedTitle);

            const normalizedTitle = normalize(hydrated.title);
            this.release.setTitle(normalizedMatchedTitle.startsWith(normalizedTitle) ? matchedTitle : hydrated.title);

            this.release.setOriginalTitle('');
            if (hydrated.title !== hydrated.originalTitle) {
                const normalizedOriginalTitle = normalize(hydrated.originalTitle);
                this.release.setOriginalTitle(
                    normalizedMatchedTitle.startsWith(normalizedOriginalTitle) ?
                        matchedTitle :
                        hydrated.originalTitle
                );
            }

            this.tmdbSelected = hydrated;
            this.emitUpdate('tmdbSelected');
            this.trackers?.setRelease(this.release);


            let malId: number | null = null;
            if (hydrated.keywords.includes('anime')) {
                try {
                    malId = await getMalId(hydrated.title, hydrated.originalTitle, this.release.category, hydrated.year);
                } catch (error) {
                    log(errorString('Getting MAL ID from Jikan failed', error), 'tomato');
                }
            }

            if (this.mediaInfo) await this.mediaInfo;
            this.signal.throwIfAborted();
            if (this.trackers) {
                this.trackers.setMetadata({ malId, ...hydrated });
                this.trackers.search();
            }

        } catch (error) {
            this.errors.push(errorString('Problem with TMDB while getting extra metadata', error));
            this.emitUpdate('errors');
        }

    }

    async setMediaInfo(path: string) {

        try {

            if (!this.files) throw Error('Files not initialized');
            this.files.checkPath(path);

            if (path === this.mediaInfoFile) return;
            this.mediaInfoFile = path;

            this.mediaInfo = getMediaInfo(path);
            this.trackers?.setMediaInfo(this.mediaInfo);

            const mediaInfo = await this.mediaInfo;
            this.signal.throwIfAborted();


            if (mediaInfo.defaultVideo) {

                const { Format, Width, Height, ScanType, HDR_Format, HDR_Format_Profile, transfer_characteristics,
                        MaxCLL } = mediaInfo.defaultVideo;

                if (Format) this.release.setVideoCodec(Format);
                if (Width && Height) this.release.setDimensions(Width, Height, ScanType);
                if (HDR_Format) this.release.setHdrFormat(HDR_Format, HDR_Format_Profile, transfer_characteristics, MaxCLL);

            }

            if (mediaInfo.defaultAudio) {

                const { Format, Format_AdditionalFeatures, Channels, ChannelLayout, Language } = mediaInfo.defaultAudio;

                if (Format) this.release.setAudioCodec(
                    Format_AdditionalFeatures ? `${Format} ${Format_AdditionalFeatures}` : Format
                );

                if (ChannelLayout) {
                    this.release.setChannelLayout(ChannelLayout);
                } else if (Channels) {
                    switch (Channels) {
                        case 8: this.release.setChannels('7.1'); break;
                        case 6: this.release.setChannels('5.1'); break;
                        case 2: this.release.setChannels('2.0'); break;
                        // Trust whatever was in the filename for any other unusual formats
                    }
                }

                if (Language) this.release.setLanguage(Language);

            }

            const audioLanguages = new Set(mediaInfo.audio
                .filter(track => !(track.Title?.toLowerCase().includes('commentary')))
                .map(audio => audio.Language)
            );
            if (audioLanguages.size >= 3) {
                this.release.setMultiAudio('Multi');
            } else if (audioLanguages.size === 2) {
                this.release.setMultiAudio('Dual-Audio');
            }

            this.emitUpdate('files');
            this.trackers?.setRelease(this.release);

        } catch (error) {
            this.handleError(`Couldn't set MediaInfo for ${basename(path)}`, error);
        }

    }

    setScreenshotCount(path: string, count: number) {
        if (!this.files) throw Error("Couldn't set screenshots, files not initialized");
        this.files.setScreenshotCount(path, count);
    }

    toJSON(key?: string, sentAsEvent: boolean = true): Partial<UploadState> {

        const output: Partial<UploadState> = {};

        if (!key || key === 'errors') output.errors = this.errors;
        if (!key || key === 'id') output.id = this.id;
        if (!key || key === 'release') output.release = this.release.toJSON();
        if (!key || key === 'tmdbResults') output.tmdbResults = this.tmdbResults;
        if (!key || key === 'tmdbSelected') output.tmdbSelected = this.tmdbSelected;
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