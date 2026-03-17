import type { Image } from '$lib/types';
import { file } from 'bun';
import type ImageHost from './image-host';
import { imageHosts } from './image-hosts/index';
import settings from './settings';
import errorString from './util/error-string';
import { log } from './util/log';

type ImageHostList = { name: string, imageHost: ImageHost }[];

const cache: Map<string, { rejected: boolean, promise: Promise<Image> }> = new Map();

function initializeImageHosts() {

    const output: ImageHostList = [];

    for (const imageHostSettings of settings.all().imageHosts) {

        if (!(imageHostSettings.name in imageHosts)) {
            throw Error(`Couldn't find image host ${imageHostSettings.name}`);
        }

        const imageHost = imageHosts[imageHostSettings.name]!.object;

        output.push({
            name: imageHostSettings.name,
            imageHost
        });

    }

    return output;

}

async function getMaxSize(paths: string[]) {

    let maxSize = 0;

    for (const path of paths) {
        const image = await file(path).stat();
        if (image.size > maxSize) maxSize = image.size;
    }

    return maxSize;

}

function filterImageHosts(imageHosts: ImageHostList, maxSize: number, allowedImageHosts?: string[], blockedImageHosts?: string[]): ImageHostList {

    imageHosts = imageHosts.filter(imageHost => imageHost.imageHost.maxSize >= maxSize);

    if (allowedImageHosts) {
        return imageHosts.filter(imageHost => allowedImageHosts.includes(imageHost.name));
    }

    if (blockedImageHosts) {
        return imageHosts.filter(imageHost => !blockedImageHosts.includes(imageHost.name));
    }

    return imageHosts;

}

function sortImageHosts(imageHosts: ImageHostList, imageHostOrder: string[]) {

    const output: ImageHostList = [];

    for (const imageHostName of imageHostOrder) {
        const imageHost = imageHosts.find(imageHost => imageHost.name === imageHostName);
        if (imageHost) output.push(imageHost);
    }

    const unassignedImageHosts = imageHosts.filter(imageHost => {
        return !output.find(outputImageHost => outputImageHost.name === imageHost.name)
    });

    output.push(...unassignedImageHosts);

    return output;

}

export async function uploadScreenshots({
    paths, imageHostOrder, thumbnailWidth = 350, allowedImageHosts, blockedImageHosts, limit = Infinity, signal
}: {
    paths: string[],
    imageHostOrder: string[],
    thumbnailWidth?: number,
    allowedImageHosts?: string[],
    blockedImageHosts?: string[],
    limit?: number,
    signal: AbortSignal
}): Promise<Image[]> {

    paths = paths.slice(0, limit);

    const imageHosts = initializeImageHosts();
    const maxSize = await getMaxSize(paths);
    const filteredImageHosts = filterImageHosts(imageHosts, maxSize, allowedImageHosts, blockedImageHosts);
    const sortedImageHosts = sortImageHosts(filteredImageHosts, imageHostOrder);

    const failedImageHosts = [];

    for (const { name, imageHost } of sortedImageHosts) {

        try {

            log(`Uploading ${Math.min(paths.length, limit ?? Infinity)} screenshots to ${name}`)

            const uploadPromises = paths.map(path => {
                const key = `${path}:${name}:${thumbnailWidth}`;
                const cached = cache.get(key);
                
                if (cached && !cached.rejected) {
                    return cached.promise;
                }
                
                const promise = imageHost.upload(path, thumbnailWidth, signal);
                const wrapper = { promise, rejected: false };
                
                promise.then(
                    () => { log(`Uploaded a screenshot to ${name}`, 'aquamarine'); },
                    () => { wrapper.rejected = true; }
                );
                
                cache.set(key, wrapper);
                return promise;
            });

            const images = await Promise.all(uploadPromises);
            log(`Uploaded ${images.length} screenshots to ${name}`, 'aquamarine');
            return images;

        } catch (error) {
            log(errorString(`Uploading to ${name} failed`, error), 'khaki');
            failedImageHosts.push(errorString(`Uploading to ${name} failed`, error));
        }

    }

    if (failedImageHosts.length > 0) {
        throw Error(failedImageHosts.join('; '));
    }

    throw Error(
        imageHosts.length > 0 ?
            'No image hosts tried (all filtered by file size, allow list, or block list)' :
            'No image hosts configured'
    );

}