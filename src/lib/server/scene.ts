import { file, hash } from 'bun';
import { basename, extname } from 'node:path';
import PQueue from 'p-queue';
import * as v from 'valibot';
import Release from './release';
import { streamingServiceAliases, streamingServices, type StreamingService } from './release-tables';
import { pauseHashing, resumeHashing } from './torrent';
import errorString from './util/error-string';
import { log } from './util/log';
import responseToJson from './util/response-to-json';

/* srrDB asks to be used but not scraped, and refuses connections when it's
   hit too quickly */
const requestQueue = new PQueue({ concurrency: 1, intervalCap: 1, interval: 1000 });
const hashQueue = new PQueue({ concurrency: 1 });

const API_URL = 'https://api.srrdb.com/v1';
const CACHE_SIZE = 100;
// TMDB waits on this, so a hanging srrDB can't be allowed to hold up the upload
const REQUEST_TIMEOUT = 15_000;

const SearchSchema = v.object({
    results: v.array(v.object({
        release: v.string(),
        hasNFO: v.string(),
    })),
});

const NfoSchema = v.object({
    nfo: v.optional(v.array(v.string()), []),
    nfolink: v.optional(v.array(v.string()), []),
});

type SearchResult = v.InferOutput<typeof SearchSchema>['results'][number];

export interface SceneRelease {
    name: string;
    nfo: File | null;
    streamingService: StreamingService | null;
}

const cache = new Map<string, SceneRelease | null>();

const streamingServicesByName = new Map<string, StreamingService>();
for (const name of streamingServices) streamingServicesByName.set(name.toLowerCase(), name);
for (const [name, aliases] of Object.entries(streamingServiceAliases) as [StreamingService, readonly string[]][]) {
    for (const alias of aliases) streamingServicesByName.set(alias.toLowerCase(), name);
}

/* Scene naming rules have never allowed audio codecs or streaming services in
   release names, so either one means this can't be an untouched scene file */
export function mightBeScene(fileName: string) {
    const release = new Release(fileName);
    return !release.audioCodec && !release.streamingService;
}

/* NFO layouts are up to each group, but when one names the service it's on a
   "Source : AMAZON" style line, usually padded out with dots or dashes */
export function findNfoStreamingService(nfo: string) {

    for (const line of nfo.split(/\r?\n/)) {

        const value = line.match(/^[^a-z0-9]*source[\s._-]*:(.*)$/i)?.[1];
        if (!value) continue;

        for (const word of value.split(/[^\w+]+/)) {
            const streamingService = streamingServicesByName.get(word.toLowerCase());
            if (streamingService) return streamingService;
        }

    }

    return null;

}

/**
 * Looks for the file inside a release on srrDB by its exact size, and by its
 * CRC as well when the size alone doesn't settle it
 */
export async function findSceneRelease(path: string, signal: AbortSignal): Promise<SceneRelease | null> {

    const stat = await file(path).stat();
    // A size of 0 would match every release srrDB has
    if (!stat.isFile() || stat.size === 0) return null;

    const key = [path, stat.size, stat.mtimeMs].join('\0');
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const match = await matchRelease(path, stat.size, signal);
    const scene = match ? await getSceneRelease(match, signal) : null;

    // Left uncached when the NFO download failed, so opening the file again retries it
    const nfoFailed = match?.hasNFO === 'yes' && !scene?.nfo;
    if (!nfoFailed) {
        cache.set(key, scene);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
    }

    return scene;

}

async function matchRelease(path: string, size: number, signal: AbortSignal) {

    const bySize = await search([`archive-size:${size}`], signal);
    if (bySize.length === 0) return null;

    /* Old releases were often packed under short names like "tdf-hpatcos.avi",
       and sizes collide when rips were made to fit a CD, so anything short of
       a unique size and a matching name gets the CRC checked */
    const stem = basename(path, extname(path)).toLowerCase();
    if (bySize.length === 1 && bySize[0]!.release.toLowerCase() === stem) return bySize[0]!;

    const crc = await hashQueue.add(() => getCrc(path, signal), { signal });
    const byCrc = await search([`archive-crc:${crc}`, `archive-size:${size}`], signal);

    return byCrc.length === 1 ? byCrc[0]! : null;

}

async function getSceneRelease(match: SearchResult, signal: AbortSignal): Promise<SceneRelease> {

    const scene: SceneRelease = { name: match.release, nfo: null, streamingService: null };
    if (match.hasNFO !== 'yes') return scene;

    try {
        scene.nfo = await getNfo(match.release, signal);
        if (scene.nfo) scene.streamingService = findNfoStreamingService(new TextDecoder('latin1').decode(await scene.nfo.arrayBuffer()));
    } catch (error) {
        signal.throwIfAborted();
        log(errorString(`Couldn't download the NFO for ${match.release}`, error), 'khaki');
    }

    return scene;

}

async function getCrc(path: string, signal: AbortSignal) {

    log(`Checking the CRC of ${basename(path)} against srrDB`);
    pauseHashing();

    try {
        let crc = 0;
        for await (const chunk of file(path).stream()) {
            signal.throwIfAborted();
            crc = hash.crc32(chunk, crc);
        }
        return crc.toString(16).toUpperCase().padStart(8, '0');
    } finally {
        resumeHashing();
    }

}

async function getNfo(release: string, signal: AbortSignal) {

    const listing = await requestQueue.add(async () => {
        const response = await fetch(`${API_URL}/nfo/${encodeURIComponent(release)}`, { signal: withTimeout(signal) });
        return v.parse(NfoSchema, await responseToJson(response));
    }, { signal });

    const [name] = listing.nfo;
    const [link] = listing.nfolink;
    if (!name || !link) return null;

    const nfo = await requestQueue.add(async () => {
        const response = await fetch(link, { signal: withTimeout(signal) });
        if (!response.ok) throw Error(`${response.status} ${response.statusText}`);
        return await response.arrayBuffer();
    }, { signal });

    return new File([nfo], name, { type: 'text/plain' });

}

function withTimeout(signal: AbortSignal) {
    return AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT)]);
}

async function search(keywords: string[], signal: AbortSignal) {

    return await requestQueue.add(async () => {
        const response = await fetch(`${API_URL}/search/${keywords.join('/')}`, { signal: withTimeout(signal) });
        return v.parse(SearchSchema, await responseToJson(response)).results;
    }, { signal });

}
