import { file, type BunFile } from 'bun';
import { mediaInfoFactory } from 'mediainfo.js';
import type { AudioTrack, GeneralTrack, ImageTrack, MenuTrack, OtherTrack, ReadChunkFunc, TextTrack, Track, VideoTrack } from 'mediainfo.js';
import { basename } from 'node:path';
import errorString from './util/error-string';
import { pauseHashing, resumeHashing } from './torrent';
import { log } from './util/log';

class MediaInfo {

    private path: string;

    fullText: string = '';
    tracks: Track[] = [];
    general: GeneralTrack[] = [];
    audio: AudioTrack[] = [];
    image: ImageTrack[] = [];
    menu: MenuTrack[] = [];
    other: OtherTrack[] = [];
    text: TextTrack[] = [];
    video: VideoTrack[] = [];
    defaultAudio: AudioTrack | undefined;
    defaultVideo: VideoTrack | undefined;

    constructor(path: string) {
        this.path = path;
    }

    async analyze(fileHandle: BunFile, fileSize: number, type: 'text'): Promise<string>;
    async analyze(fileHandle: BunFile, fileSize: number, type: 'tracks'): Promise<Track[]>;
    async analyze(fileHandle: BunFile, fileSize: number, outputFormat: 'text' | 'tracks'): Promise<string | Track[]> {

        try {

            const mediaInfo = await mediaInfoFactory({
                format: outputFormat === 'text' ? 'text' : 'object',
                full: outputFormat !== 'text',
            });

            const readChunk: ReadChunkFunc = async (size, offset) => {
                const buffer = new Uint8Array(size);
                const blob = fileHandle.slice(offset, offset + size);
                const arrayBuffer = await blob.arrayBuffer();
                return new Uint8Array(arrayBuffer);
            }

            pauseHashing();

            const result = await mediaInfo.analyzeData(fileSize, readChunk);

            if (typeof result === 'string') {
                return result;
            }

            if (!result.media) {
                throw Error(`No media info found`);
            }

            return result.media.track;

        } catch (error) {
            throw error;
        } finally {
            resumeHashing();
        }

    }

    getDefaultAudio(): AudioTrack | undefined {

        const defaultAudio = this.audio.find(audio => audio.Default === 'Yes');
        if (defaultAudio) return defaultAudio;

        const firstAudio = this.audio.find(audio => audio);
        return firstAudio;

    }

    getDefaultVideo(): VideoTrack | undefined {

        const defaultVideo = this.video.find(video => video.Default === 'Yes');
        if (defaultVideo) return defaultVideo;

        const firstVideo = this.video.find(video => video);
        return firstVideo;

    }

    async get() {

        const video = file(this.path);
        const fileSize = (await video.stat()).size;

        this.fullText = await this.analyze(video, fileSize, 'text');
        this.tracks = await this.analyze(video, fileSize, 'tracks');

        this.fullText = this.fullText.replace(
            /(?:^|\r\n|\r|\n)General(\r\n|\r|\n)(.+?)(\r\n|\r|\n)/i,
            `$&Complete name                            : ${basename(this.path)}$1`
        );

        this.fullText = this.fullText.replace(/ {2,}/g, ' ');

        this.general = this.tracks.filter(value => value['@type'] === 'General');
        this.audio = this.tracks.filter(value => value['@type'] === 'Audio');
        this.image = this.tracks.filter(value => value['@type'] === 'Image');
        this.menu = this.tracks.filter(value => value['@type'] === 'Menu');
        this.other = this.tracks.filter(value => value['@type'] === 'Other');
        this.text = this.tracks.filter(value => value['@type'] === 'Text');
        this.video = this.tracks.filter(value => value['@type'] === 'Video');

        this.defaultAudio = this.getDefaultAudio();
        this.defaultVideo = this.getDefaultVideo();

    }

}

export default async function getMediaInfo(path: string): Promise<MediaInfo> {
    try {
        log(`Getting MediaInfo for ${basename(path)}`);
        const mediaInfo = new MediaInfo(path);
        await mediaInfo.get();
        log(`Received MediaInfo for ${basename(path)}`, 'aquamarine');
        return mediaInfo;
    } catch (error) {
        throw Error(errorString(`Couldn't get MediaInfo for ${basename(path)}`, error))
    }
}