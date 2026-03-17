import type { SettingsField } from '$lib/types';
import { qBittorrent, settings as qBittorrentSettings } from './qbittorrent';
import type TorrentClient from '../torrent-client';

export const torrentClients: Record<string, { object: TorrentClient, fields: SettingsField[] }> = {
    'qBittorrent': {
        object: qBittorrent,
        fields: qBittorrentSettings
    },
};