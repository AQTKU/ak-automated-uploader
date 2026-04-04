import type { SettingsField, TorrentClientSettings } from '$lib/types';
import getCookies from '../util/get-cookies';
import errorString from '../util/error-string';
import path, { basename } from 'node:path';
import TorrentClient from '../torrent-client';
import { log } from '../util/log';
import * as v from 'valibot';
import posixPath from 'node:path/posix';
import win32Path from 'node:path/win32';
import { file } from 'bun';

export const settings: SettingsField[] = [
    {
        id: 'url',
        label: 'WebUI URL',
        description: 'The IP address and port to access the WebUI (like http://192.168.0.100:12345).',
        type: 'url',
    },
    {
        id: 'username',
        label: 'User name',
        type: 'text',
    },
    {
        id: 'password',
        label: 'Password',
        type: 'password',
    },
];

interface QBittorrentSettings extends TorrentClientSettings {
    url: string;
    username: string;
    password: string;
}

class QBittorrent extends TorrentClient {

    public name: string = 'qBittorrent';

    private url: string = '';
    private username: string = '';
    private password: string = '';
    private cookies: string = '';

    private path: typeof path = path;

    private async checkLogin(): Promise<boolean> {
        
        try {
            await this.get('api/v2/app/version');
        } catch {
            return false;
        }

        return true;

    }

    async configure(settings: QBittorrentSettings) {

        if (!settings.url.endsWith('/')) settings.url += '/';

        this.url = settings.url;
        this.username = settings.username;
        this.password = settings.password;

        this.cookies = '';

        const isLoggedIn = await this.checkLogin();
        if (!isLoggedIn) await this.login();

        log('qBittorrent configured', 'aquamarine');

    }

    private async get(endpoint: string, data?: URLSearchParams): Promise<Response> {

        const url = new URL(endpoint, this.url);
        if(data) url.search = data.toString();

        const headers: Record<string, string> = { 'Referer': `${url.protocol}//${url.host}` };
        if (this.cookies) headers.Cookie = this.cookies;

        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            throw Error(await response.text());
        }

        return response;

    }

    private async getCategories(defaultSavePath: string = '') {

        const response = await this.get('api/v2/torrents/categories');
        const body = await response.json();

        const validated = v.parse(
            v.record(v.string(), v.object({
                name: v.string(),
                savePath: v.string(),
            })),
            body
        );

        const categories = Object.values(validated);
        
        for (const category of categories) {
            if (this.path.isAbsolute(category.savePath)) {
                category.savePath = this.path.join(category.savePath);
                continue;
            }
            category.savePath = category.savePath || category.name;
            category.savePath = this.path.join(defaultSavePath, category.savePath);
        }

        return categories;

    }

    private async getCategory(savePath: string, contentFolder: string) {

        const categories = await this.getCategories(savePath);
        const foundCategory = categories.find(
            category => this.path.relative(category.savePath, contentFolder) === ''
        );
        return foundCategory?.name;

    }

    private async getPreferences() {

        const response = await this.get('api/v2/app/preferences');
        const body = await response.json();

        const validated = v.parse(
            v.object({
                auto_tmm_enabled: v.boolean(),
                save_path: v.string(),
            }),
            body
        )

        this.setPlatform(validated.save_path);

        return validated;

    }

    private async login(): Promise<void> {

        try {

            if (!this.url) throw Error('Missing URL');

            const response = await this.post('api/v2/auth/login', new URLSearchParams({
                username: this.username,
                password: this.password,
            }));

            const cookies = getCookies(response);
            if (!cookies) throw Error('No cookies received');
            this.cookies = cookies;

        } catch (error) {
            throw Error(errorString('Failed to log in to the Web UI', error));
        }

    }

    private async post(endpoint: string, body?: FormData | URLSearchParams, signal?: AbortSignal): Promise<Response> {

        const url = new URL(endpoint, this.url);

        /* The qBittorrent web UI will abort the connection if it receives
           something with Transfer-Encoding: chunked, which is fetch()'s
           behaviour when receiving a FormData in the body.

           So we're going to build a Request first, consume and encode the
           FormData in the request by calling Request.blob(), then use that blob
           to set a Content-Length, which disables chunked transfer encoding */

        const headers: Record<string, string> = { 'Referer': `${url.protocol}//${url.host}` };
        if (this.cookies) headers.Cookie = this.cookies;

        const request = new Request(url, { method: 'POST', headers, body });

        const blob = await request.blob();

        request.headers.set('Content-Length', String(blob.size));

        const options: RequestInit = {
            method: request.method,
            headers: request.headers,
            body: blob,
            signal
        };

        const response = await fetch(url, options);

        if (!response.ok) {
            throw Error(await response.text());
        }

        return response;

    }

    async send(torrentPath: string, relativeContentPath: string | undefined, signal?: AbortSignal) {

        try {

            const isLoggedIn = await this.checkLogin();
            if (!isLoggedIn) await this.login();

            const { save_path, auto_tmm_enabled } = await this.getPreferences();

            let localRelativeContentPath = '';
            if (relativeContentPath) localRelativeContentPath = relativeContentPath.replaceAll(path.sep, this.path.sep);
            const contentFolder = this.path.join(save_path, localRelativeContentPath);

            let category;
            if (relativeContentPath && auto_tmm_enabled) {
                category = await this.getCategory(save_path, contentFolder);
            }

            const formData = new FormData();

            formData.set('skip_checking', 'true');
            if (category) formData.set('category', category);
            else if (this.path.relative(save_path, contentFolder) !== '') {
                formData.set('savepath', contentFolder);
                formData.set('autoTMM', 'false');
            }
            formData.set('torrents', file(torrentPath), basename(torrentPath));

            await this.post('api/v2/torrents/add', formData, signal);

        } catch (error) {
            throw Error(errorString('Failed to upload torrent file', error));
        }

    }

    private setPlatform(savePath: string) {
        if (posixPath.isAbsolute(savePath)) this.path = posixPath;
        else if (win32Path.isAbsolute(savePath)) this.path = win32Path;
        else throw Error(`Save path from qBittorrent settings isn't an absolute path, received "${savePath}"`)
    }

}

export const qBittorrent = new QBittorrent();