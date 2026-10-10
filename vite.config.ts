import adapter from './adapter/index.ts';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			inspector: true,
			adapter: adapter(),
			csp: { mode: 'auto', directives: {} }
		})
	]
});
