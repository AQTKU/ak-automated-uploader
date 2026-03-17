import type { TorrentClientSettings } from '$lib/types';

export default abstract class TorrentClient {
    abstract configure(settings: TorrentClientSettings): Promise<void>;
    abstract send(path: string, relativeToRoot: string | undefined, signal?: AbortSignal): Promise<void>;
}