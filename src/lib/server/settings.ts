import appDataPath from './util/app-data-path';
import errorString from './util/error-string';
import { TrackerSettingsSchema, SettingsSchema, ImageHostSettingsSchema, TorrentClientSettingsSchema } from '$lib/types';
import type { SettingsField,  SettingsList, SettingsOption, TrackerSettings, ImageHostSettings, TorrentClientSettings } from '$lib/types';
import buildSchemaFromFields from './util/build-schema-from-fields';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { log } from './util/log';
import { file } from 'bun';
import { imageHosts } from './image-hosts';
import { torrentClients } from './torrent-clients';
import { tmdb } from './tmdb';
import * as v from 'valibot';

class Settings {

    private settings: SettingsList;
    private imageHostOptions: SettingsOption[] = [];
    private torrentClientOptions: SettingsOption[] = [];
    private trackerOptions: SettingsOption[] = [];
    private changeCallbacks: ((settings: SettingsList) => Promise<void>)[] = [];
    private _isFirstBoot = false;

    constructor() {

        this.settings = v.parse(SettingsSchema, {});

    }

    addImageHost(settings: ImageHostSettings) {

        if (!('name' in settings)) {
            throw Error('Tried to add image host with no name');
        }

        const option = this.imageHostOptions.find(option => option.name === settings.name);
        if (!option) {
            throw Error(`Tried to add unknown image host type: ${settings.name}`);
        }

        const schema = buildSchemaFromFields(option.fields, option.name);
        const defaultsAdded = v.parse(schema, settings);
        const validated = v.parse(ImageHostSettingsSchema, defaultsAdded);

        this.settings.imageHosts.push(validated);

    }

    addImageHostOption(name: string, fields: SettingsField[]) {
        this.imageHostOptions.push({ name, fields });
    }

    addTorrentClient(settings: TorrentClientSettings) {
        if (!('name' in settings)) {
            throw Error('Tried to add torrent client with no name');
        }

        const option = this.torrentClientOptions.find(option => option.name === settings.name);
        if (!option) {
            throw Error(`Tried to add unknown torrent client type: ${settings.name}`);
        }

        const schema = buildSchemaFromFields(option.fields, option.name);
        const defaultsAdded = v.parse(schema, settings);
        const validated = v.parse(TorrentClientSettingsSchema, defaultsAdded);

        this.settings.torrentClient = validated;
    }

    addTorrentClientOption(name: string, fields: SettingsField[]) {
        this.torrentClientOptions.push({ name, fields });
    }

    addTracker(settings: TrackerSettings) {
        if (!('name' in settings)) {
            throw Error('Tried to add tracker with no name');
        }

        const option = this.torrentClientOptions.find(option => option.name === settings.name);
        if (!option) {
            throw Error(`Tried to add unknown tracker type: ${settings.name}`);
        }

        const schema = buildSchemaFromFields(option.fields, option.name);
        const defaultsAdded = v.parse(schema, settings);
        const validated = v.parse(TrackerSettingsSchema, defaultsAdded);

        this.settings.trackers.push(validated);
    }

    addTrackerOption(name: string, fields: SettingsField[]) {

        fields.push({
            id: 'imageHosts',
            label: 'Image host order',
            type: 'imageHosts',
        });
        this.trackerOptions.push({ name, fields });

    }

    all(): SettingsList {
        return this.settings;
    }

    compareAgainstAuthToken(toCheck: string) {

        if (toCheck === '') return false;

        const existing = this.settings.authToken;
        if (!existing) return false;

        const encoder = new TextEncoder();

        const existingBytes = new Uint8Array(encoder.encode(existing));
        const toCheckBytes = new Uint8Array(encoder.encode(toCheck));

        if (existingBytes.length !== toCheckBytes.length) return false;
        if (!timingSafeEqual(existingBytes, toCheckBytes)) return false;

        return true;

    }

    completeFirstBoot() {
        this._isFirstBoot = false;
    }

    async configureApp(settings: SettingsList) {

        const promises = [];

        try {
            await tmdb.configure({ apiKey: settings.tmdbApiKey });
        } catch (error) {
            throw Error(errorString('Problem configuring TMDB', error));
        }

        for (const imageHost in imageHosts) {
            const found = settings.imageHosts.find(setting => setting.name === imageHost);
            if (!found) continue;
            try {
                await imageHosts[imageHost]!.object.configure(found);
            } catch (error) {
                throw Error(errorString(`Problem configuring ${imageHost}`, error));
            }
        }

        for (const torrentClient in torrentClients) {
            const found = settings.torrentClient?.name === torrentClient;
            if (!found || !settings.torrentClient) continue;
            try {
                await torrentClients[torrentClient]!.object.configure(settings.torrentClient);
            } catch (error) {
                throw Error(errorString(`Problem configuring ${torrentClient}`, error));
            }
        }

    }

    async emitChanged(settings: SettingsList) {
        await Promise.all(this.changeCallbacks.map(callback => callback(settings)));
    }

    get isFirstBoot() { return this._isFirstBoot; }

    private generateAuthToken() {
        const token = randomBytes(32).toString('base64url');
        log(`Your login token is: ${token}`, 'aquamarine');
        return token;
    }

    async generateApiKey() {
        const apiKey = randomBytes(32).toString('base64url');
        this.settings.apiKey = apiKey;
        log('API key generated');
        await this.save();
        return apiKey;
    }

    getAvailableImageHostOptions() {
        const selected = this.settings.imageHosts.map(option => option.name);
        return this.imageHostOptions.filter(option => !selected.includes(option.name));
    }

    getAvailableTorrentClientOptions() {
        if (this.settings.torrentClient && this.torrentClientOptions.find(option => option.name === this.settings.torrentClient?.name)) return [];
        return this.torrentClientOptions;
    }

    getAvailableTrackerOptions() {
        const selected = this.settings.trackers.map(option => option.name);
        return this.trackerOptions.filter(option => !selected.includes(option.name));
    }

    getSelectedImageHostOptions() {
        const selected = this.settings.imageHosts.map(option => option.name);
        return this.imageHostOptions.filter(option => selected.includes(option.name));
    }

    getSelectedTorrentClientOptions() {
        if (this.settings.torrentClient) return this.torrentClientOptions.filter(option => option.name === this.settings.torrentClient?.name);
        else return [];
    }

    getSelectedTrackerOptions() {
        const selected = this.settings.trackers.map(option => option.name);
        return this.trackerOptions.filter(option => selected.includes(option.name));
    }

    get apiKey() { return this.settings.apiKey }
    get contentFolder() { return this.settings.contentFolder }
    get torrentClient() { return this.settings.torrentClient; }

    async load() {

        let authToken;

        try {

            log('Loading settings from file');

            const path = await appDataPath('settings.json');
            const data = await file(path).json();

            authToken = data.authToken;

            if (!authToken) {
                this._isFirstBoot = true;
                authToken = this.generateAuthToken();
                data.authToken = authToken;
            }

            await this.set(data, true);

            log('Settings loaded', 'aquamarine');

        } catch (error) {
            log(errorString('Error reading settings from file', error), 'tomato');
            log('Using default settings', 'tomato');
            this.settings = v.parse(SettingsSchema, { authToken });
        }

    }

    onChange(callback: (settings: SettingsList) => Promise<void>) {
        this.changeCallbacks.push(callback);
    }

    async rescindApiKey() {
        this.settings.apiKey = null;
        log('API key rescinded');
        await this.save();
    }

    async save() {

        try {

            const path = await appDataPath('settings.json');
            const text = JSON.stringify(this.settings, undefined, 2);

            await file(path).write(text);

        } catch (error) {
            throw Error(errorString('Problem saving settings', error));
        }

    }

    async set(data: Object, saveAuthToken = false, throwOnMisconfigured = false) {

        const currentAuthToken = this.settings.authToken;

        const settings = v.parse(SettingsSchema, data);
        settings.authToken = (saveAuthToken && settings.authToken) ? settings.authToken : currentAuthToken;

        try {
            await this.configureApp(settings);
        } catch (error) {
            log(errorString('Problem with settings', error), 'tomato');
            if (throwOnMisconfigured) throw error;
        }

        await this.emitChanged(settings);
        this.settings = settings;

        await this.save();

    }

    async unsetAuthToken() {
        delete this.settings.authToken;
        this.settings.authToken = this.generateAuthToken();
        this._isFirstBoot = true;
        await this.save();
    }

}

export type { Settings };

const settings = new Settings();
export default settings;