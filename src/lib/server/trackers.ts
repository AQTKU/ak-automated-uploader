import type getMediaInfo from '$lib/server/mediainfo';
import type Release from './release';
import settings from './settings';
import type { Metadata, TrackerErrorState, TrackerFieldsState, TrackersAfterUploadActionsState, TrackerSearchResultState, TrackerState, TrackerStatusState } from '$lib/types';
import type Torrent from './torrent';
import { trackers } from './trackers/index';
import type Tracker from './tracker';
import errorString from './util/error-string';
import trackerNameToId from '$lib/util/tracker-name-to-id';

export class Trackers {

    actionsAddedCallbacks: Array<(actions: TrackersAfterUploadActionsState[]) => void> = [];
    dataChangedCallbacks: Array<(state: TrackerState[]) => void> = [];
    errorCallbacks: Array<(state: TrackerErrorState[]) => void> = [];
    searchResultCallbacks: Array<(state: TrackerSearchResultState[]) => void> = [];
    searchResults: TrackerSearchResultState[] = [];
    signal: AbortSignal;
    statusChangedCallbacks: Array<(state: TrackerStatusState[]) => void> = [];
    trackers: Tracker[] = [];

    constructor(signal: AbortSignal) {

        this.signal = signal;

        for (const trackerSettings of settings.all().trackers) {

            if (!(trackerSettings.name in trackers)) {
                throw Error(`Couldn't find tracker ${trackerSettings.name}`);
            }

            const tracker = new trackers[trackerSettings.name]!.class(trackerSettings);
            this.add(tracker);

        }

    }

    add(tracker: Tracker) {
        tracker.onDataChanged(() => this.emitDataChanged());
        tracker.onError(() => this.emitErrors());
        tracker.onStatusChanged(() => this.emitStatusChanged());
        tracker.onActionAdded(() => this.emitActions());
        tracker.setSignal(this.signal);
        this.trackers.push(tracker);
    }

    async cleanup() {
        for (const tracker of this.trackers) {
            await tracker.cleanup();
        }
    }

    async configure() {

        const settingsTrackerNames = new Set(
            settings.all().trackers.map(trackerSettings => trackerSettings.name)
        );

        for (const tracker of this.trackers) {
            if (!settingsTrackerNames.has(tracker.name)) {
                await tracker.cleanup();
            }
        }
        this.trackers = this.trackers.filter(tracker =>
            settingsTrackerNames.has(tracker.name)
        );

        for (const trackerSettings of settings.all().trackers) {

            if (!(trackerSettings.name in trackers)) {
                throw Error(`Couldn't find tracker ${trackerSettings.name}`);
            }

            let tracker = this.trackers.find(tracker => tracker.name === trackerSettings.name);
            if (tracker) {
                tracker.configure(trackerSettings);
            } else {
                tracker = new trackers[trackerSettings.name]!.class(trackerSettings);
                this.add(tracker);
            }

        }

    }

    emitActions() {
        for (const callback of this.actionsAddedCallbacks) {
            callback(this.getActions());
        }
    }

    emitDataChanged() {
        for (const callback of this.dataChangedCallbacks) {
            callback(this.getState());
        }
    }

    emitErrors() {
        for (const callback of this.errorCallbacks) {
            callback(this.getErrorState());
        }
    }
    
    emitSearchResults() {
        for (const callback of this.searchResultCallbacks) {
            callback(this.getSearchResults());
        }
    }

    emitStatusChanged() {
        for (const callback of this.statusChangedCallbacks) {
            callback(this.getStatus());
        }
    }

    getActions(): TrackersAfterUploadActionsState[] {
        return this.trackers.map((tracker, index) => ({
            tracker: tracker.name,
            actions: tracker.getActionState(),
        }));
    }

    getErrorState(): TrackerErrorState[] {
        const errors = this.trackers.map(tracker => ({
            tracker: tracker.name,
            errors: tracker.getErrorState(),
        }));
        return errors;
    }

    getFields(): TrackerFieldsState[] {
        return this.trackers.map(tracker => ({
            name: tracker.name,
            fields: tracker.getFieldState(),
        }));
    }

    getSearchResults(): TrackerSearchResultState[] {
        return this.searchResults;
    }

    getStatus(): TrackerStatusState[] {
        const output: TrackerStatusState[] = [];
        for (const tracker of this.trackers) {
            output.push({
                tracker: tracker.name,
                status: tracker.getStatusState(),
            });
        }
        return output;
    }

    getState(): TrackerState[] {

        const output: TrackerState[] = [];

        for (const tracker of this.trackers) {
            
            output.push({
                name: tracker.name,
                searchResults: [],
                status: '',
                data: tracker.getDataState(),
            });

        }

        return output;

    }

    getTrackerById(id: string) {
        const tracker = this.trackers.find(tracker => trackerNameToId(tracker.name) === id);
        if (!tracker) throw Error(`Couldn't find tracker ${id}`);
        return tracker;
    }

    onActionsAdded(callback: (actions: TrackersAfterUploadActionsState[]) => void) {
        this.actionsAddedCallbacks.push(callback);
    }

    onDataChanged(callback: (state: TrackerState[]) => void) {
        this.dataChangedCallbacks.push(callback);
    }

    onError(callback: (reason: TrackerErrorState[]) => void) {
        this.errorCallbacks.push(callback);
    }

    onSearchResults(callback: (state: TrackerSearchResultState[]) => void) {
        this.searchResultCallbacks.push(callback);
    }

    onStatusChanged(callback: (state: TrackerStatusState[]) => void) {
        this.statusChangedCallbacks.push(callback);
    }

    search() {

        this.searchResults = [];
        this.emitSearchResults();

        for (const tracker of this.trackers) {

            tracker.search().then(results => {

                this.searchResults.push({
                    tracker: tracker.name,
                    results
                });
                this.emitSearchResults();

            }).catch(error => {

                this.searchResults.push({
                    tracker: tracker.name,
                    results: [],
                    error: errorString('Search failed', error),
                });
                this.emitSearchResults();

            });

        }

    }

    setMediaInfo(mediaInfo: ReturnType<typeof getMediaInfo>) {
        this.trackers.forEach(tracker => tracker.setMediaInfo(mediaInfo));
        this.emitDataChanged();
    }

    setMetadata(metadata: Metadata) {
        this.trackers.forEach(tracker => tracker.setMetadata(metadata));
        this.emitDataChanged();
    }

    setRelease(release: Release) {
        this.trackers.forEach(tracker => tracker.setRelease(release));
        this.emitDataChanged();
    }

    setScreenshots(screenshots: Promise<string[]>) {
        this.trackers.forEach(tracker => tracker.setScreenshots(screenshots));
    }

    setTorrent(torrent: Promise<Torrent>) {
        this.trackers.forEach(tracker => tracker.setTorrent(torrent));
    }

}