import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { env, platform } from 'node:process';

let path: string | undefined = undefined;

export default async function appDataPath(file?: string): Promise<string> {
  
    if (!path) {

        path = join(
            env.APPDATA || (
            platform === 'darwin'
            ? env.HOME + '/Library/Preferences'
            : env.HOME + '/.local/share'
            ),
            'ak-automated-uploader'
        );

        await mkdir(path, { recursive: true });

    }

    if (file) {
        return join(path, file);
    } else {
        return path;
    }

}