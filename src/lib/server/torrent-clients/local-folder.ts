import type { SettingsField, TorrentClientSettings } from '$lib/types';
import errorString from '../util/error-string';
import TorrentClient from '../torrent-client';
import { basename, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { log } from '../util/log';
import { file, write } from 'bun';

export const settings: SettingsField[] = [
    {
        id: 'savePath',
        label: 'Save folder',
        description: 'The folder to save the .torrent file to, like /home/torrents or D:\\Torrents',
        type: 'path',
    },
];

interface LocalFolderSettings extends TorrentClientSettings {
    savePath: string;
}

class LocalFolder extends TorrentClient {

    public name: string = 'Local folder';

    private savePath: string = '';

    async configure(settings: LocalFolderSettings) {

        if (!settings.savePath) throw Error('Missing save path');

        this.savePath = settings.savePath;
        await mkdir(this.savePath, { recursive: true });

        log('Local Folder configured', 'aquamarine');

    }

    async send(torrentPath: string) {

        try {

            if (!this.savePath) throw Error('Not configured');

            const destination = join(this.savePath, basename(torrentPath));
            await write(destination, file(torrentPath));

        } catch (error) {
            throw Error(errorString('Failed to save torrent file', error));
        }

    }

}

export const localFolder = new LocalFolder();
