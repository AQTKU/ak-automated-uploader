import settings from './settings';
import { log } from './util/log';
import { torrentClients } from './torrent-clients';
import { dirname, isAbsolute, normalize, relative } from 'node:path';

export default async function sendTorrent(torrentPath: string, contentPath: string, signal: AbortSignal) {

    torrentPath = normalize(torrentPath);
    contentPath = normalize(contentPath);

    console.log(`Torrent path: ${contentPath}`);

    const configuredClient = settings.torrentClient;
    if (!configuredClient) throw Error('No torrent client configured');

    log(`Sending torrent to ${configuredClient.name}`)

    const torrentClient = torrentClients[configuredClient.name]?.object;
    if (!torrentClient) {
        throw Error(`Couldn't find torrent client ${configuredClient.name}`);
    }

    const parentFolder = dirname(contentPath);
    const rootContentFolder = normalize(settings.contentFolder ?? '');
    const relativePath = relative(rootContentFolder, parentFolder);
    const isInside = rootContentFolder && !relativePath.startsWith('..') && !isAbsolute(relativePath);
    await torrentClient.send(torrentPath, isInside ? relativePath : undefined, signal);

}