// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Settings } from '$lib/server/settings';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			settings: Settings,
			timeZone: string,
			locale?: string,
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
