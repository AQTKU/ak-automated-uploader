import type { SettingsField } from '$lib/types';
import { qBittorrent, settings as qBittorrentSettings } from './qbittorrent';
import { localFolder, settings as localFolderSettings } from './local-folder';
import type TorrentClient from '../torrent-client';

export const torrentClients: Record<string, { object: TorrentClient, fields: SettingsField[] }> = {
    'Local folder': {
        object: localFolder,
        fields: localFolderSettings
    },
    'qBittorrent': {
        object: qBittorrent,
        fields: qBittorrentSettings
    },
};