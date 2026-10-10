import type { Server } from '@sveltejs/kit';
import { Glob } from 'bun';
import { join } from 'node:path';

// A variable keeps TypeScript from resolving a path that only exists inside the build
const serverModule = './server/server.js';
const { server }: { server: Server } = await import(serverModule);

const clientDirectory = join(import.meta.dir, 'client');
const origin = Bun.env.ORIGIN?.replace(/\/$/, '');
const maxRequestBodySize = parseBytes(Bun.env.BODY_SIZE_LIMIT ?? '512K');
const idleTimeout = Number(Bun.env.IDLE_TIMEOUT ?? 10);

if (Number.isNaN(maxRequestBodySize)) {
	throw Error(`Invalid BODY_SIZE_LIMIT: ${Bun.env.BODY_SIZE_LIMIT}`);
}

if (Number.isNaN(idleTimeout)) {
	throw Error(`Invalid IDLE_TIMEOUT: ${Bun.env.IDLE_TIMEOUT}`);
}

await server.init({
	env: Bun.env,
	read: (file) => Bun.file(join(clientDirectory, file)).stream()
});

const assets = new Set<string>();
for await (const path of new Glob('**/*').scan({ cwd: clientDirectory })) {
	assets.add(`/${path.replaceAll('\\', '/')}`);
}

const httpServer = Bun.serve({
	hostname: Bun.env.HOST ?? '0.0.0.0',
	port: Bun.env.PORT ?? 3000,
	idleTimeout,
	maxRequestBodySize,

	fetch(request, bunServer) {
		const url = new URL(request.url);

		if (request.method === 'GET' || request.method === 'HEAD') {
			const asset = serveAsset(url.pathname);
			if (asset) return asset;
		}

		// Without ORIGIN, Bun's own URL is used, which is right for plain HTTP but not behind an HTTPS proxy
		const forwarded = origin ? new Request(origin + url.pathname + url.search, request) : request;

		return server.respond(forwarded, {
			getClientAddress: () => bunServer.requestIP(request)?.address ?? ''
		});
	}
});

console.log(`Listening on ${httpServer.url}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, async () => {
		await httpServer.stop(true);
		process.exit(0);
	});
}

function serveAsset(pathname: string): Response | undefined {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return undefined;
	}

	if (!assets.has(decoded)) return undefined;

	const headers: HeadersInit = decoded.startsWith('/_app/immutable/')
		? { 'cache-control': 'public, max-age=31536000, immutable' }
		: {};

	return new Response(Bun.file(join(clientDirectory, decoded)), { headers });
}

function parseBytes(value: string): number {
	const multipliers: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
	const multiplier = multipliers[value.slice(-1).toUpperCase()];
	return multiplier ? Number(value.slice(0, -1)) * multiplier : Number(value);
}
