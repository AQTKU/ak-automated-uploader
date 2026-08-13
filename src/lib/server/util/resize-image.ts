import { file, spawn } from 'bun';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import errorString from './error-string';

export default async function resizeImage(path: string, width: number): Promise<Blob> {

    const outputPath = join(tmpdir(), randomUUID() + '.png');

    try {

        const ffmpeg = spawn([
            'ffmpeg',
            '-y',
            '-v', 'error',
            '-i', path,
            '-vf', `scale='min(${width},iw)':-1:flags=lanczos`,
            '-frames:v', '1',
            outputPath,
        ], { stdout: 'ignore', stderr: 'pipe' });

        const stderr = (await new Response(ffmpeg.stderr).text()).trim();
        const code = await ffmpeg.exited;

        if (code !== 0) {
            throw Error(errorString(`ffmpeg exited with code ${code}`, stderr));
        }

        const bytes = await file(outputPath).bytes();
        return new Blob([bytes], { type: 'image/png' });

    } catch (error) {
        throw Error(errorString(`Couldn't resize ${basename(path)} to ${width}px wide`, error));
    } finally {
        await file(outputPath).delete().catch(() => {});
    }

}
