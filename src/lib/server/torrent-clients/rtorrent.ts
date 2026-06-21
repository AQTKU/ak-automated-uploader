import type { SettingsField, TorrentClientSettings } from '$lib/types';
import errorString from '../util/error-string';
import TorrentClient from '../torrent-client';
import { log } from '../util/log';
import posixPath from 'node:path/posix';
import win32Path from 'node:path/win32';
import { file } from 'bun';
import { buildXmlRpcRequest, parseXmlRpcResponse, type XmlRpcParam } from '../util/xml-rpc';

export const settings: SettingsField[] = [
    {
        id: 'url',
        label: 'RPC URL',
        description: 'The XML-RPC endpoint exposed in front of rtorrent (like http://192.168.0.100/RPC2).',
        type: 'url',
    },
    {
        id: 'username',
        label: 'User name',
        description: 'Leave blank for no authentication.',
        type: 'text',
    },
    {
        id: 'password',
        label: 'Password',
        type: 'password',
    },
];

interface RTorrentSettings extends TorrentClientSettings {
    url: string;
    username: string;
    password: string;
}

class RTorrent extends TorrentClient {

    public name: string = 'rTorrent';

    private url: string = '';
    private username: string = '';
    private password: string = '';

    private path: typeof posixPath = posixPath;

    async configure(settings: RTorrentSettings) {

        if (!settings.url) throw Error('Missing URL');

        this.url = settings.url;
        this.username = settings.username;
        this.password = settings.password;

        try {
            await this.call('system.client_version');
        } catch (error) {
            throw Error(errorString("Couldn't connect to rtorrent", error));
        }

        log('rTorrent configured', 'aquamarine');

    }

    /* rtorrent's RPC dispatcher always consumes the first param as a target
       (a torrent hash, for commands scoped to one). Calls that aren't scoped
       to a torrent still need that first param present, just empty. */
    private async call(method: string, params: XmlRpcParam[] = [], signal?: AbortSignal): Promise<string> {

        const headers: Record<string, string> = { 'Content-Type': 'text/xml' };
        if (this.username) headers.Authorization = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;

        const body = buildXmlRpcRequest(method, [{ type: 'string', value: '' }, ...params]);

        const response = await fetch(this.url, { method: 'POST', headers, body, signal });

        if (!response.ok) {
            throw Error(await response.text());
        }

        return parseXmlRpcResponse(await response.text());

    }

    private setPlatform(directory: string) {
        if (posixPath.isAbsolute(directory)) this.path = posixPath;
        else if (win32Path.isAbsolute(directory)) this.path = win32Path;
        else throw Error(`Default directory from rtorrent isn't an absolute path, received "${directory}"`);
    }

    private quoteCommand(method: string, argument: string): string {
        const escaped = argument.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `${method}="${escaped}"`;
    }

    async send(torrentPath: string, relativeContentPath: string | undefined, signal?: AbortSignal) {

        try {

            const torrentData = await file(torrentPath).bytes();

            const params: XmlRpcParam[] = [{ type: 'base64', value: torrentData }];

            if (relativeContentPath) {
                const defaultDirectory = await this.call('directory.default');
                this.setPlatform(defaultDirectory);
                const contentFolder = this.path.join(defaultDirectory, relativeContentPath);
                params.push({ type: 'string', value: this.quoteCommand('d.directory_base.set', contentFolder) });
            }

            await this.call('load.raw_start', params, signal);

        } catch (error) {
            throw Error(errorString('Failed to upload torrent file', error));
        }

    }

}

export const rTorrent = new RTorrent();
