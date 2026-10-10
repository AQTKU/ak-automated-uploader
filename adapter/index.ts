import type { Adapter } from '@sveltejs/kit';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = 'build';

export default function adapter(): Adapter {
	return {
		name: 'adapter-bun',

		adapt(builder) {
			if (builder.prerendered.paths.length > 0) {
				throw Error("Prerendered pages aren't supported");
			}

			rmSync(out, { force: true, recursive: true });

			builder.log.minor('Copying assets');
			builder.writeClient(`${out}/client`);

			const serverDirectory = builder.getServerDirectory();
			builder.generateServerInstance(`${serverDirectory}/server.js`);
			builder.copy(serverDirectory, `${out}/server`);

			builder.copy(fileURLToPath(new URL('./serve.ts', import.meta.url)), `${out}/serve.ts`);
			writeFileSync(`${out}/index.js`, `import './serve.ts';\n`);
		},

		vite: {
			plugins: {
				post: [
					{
						name: 'adapter-bun',
						apply: 'build',
						config() {
							const packageJSON = JSON.parse(readFileSync('package.json', 'utf8'));
							// Production dependencies are installed next to the build, everything else has to be bundled
							return {
								ssr: {
									external: Object.keys(packageJSON.dependencies ?? {}),
									noExternal: true
								}
							};
						}
					}
				]
			}
		}
	};
}
