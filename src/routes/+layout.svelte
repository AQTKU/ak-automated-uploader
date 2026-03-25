<script lang="ts">
    import { browser } from '$app/environment';
	import { navigating, page } from '$app/state';
	import '../app.css';

	let { children } = $props();

	if (browser) {
		const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions();
		document.cookie = `timeZone=${timeZone}; path=/; max-age=31536000`;
		document.cookie = `locale=${locale}; path=/; max-age=31536000`;
	}
</script>

{#if navigating.to}
	<style>
		:root { cursor: wait }
	</style>
{/if}

<svelte:head>
	<link rel="icon" href="/logo.svg" />
</svelte:head>

{#if page.url.pathname !== '/login'}
	<header id="main-header">

		<h1><a href="/" title="AK Automated Uploader"><img alt="AK Automated Uploader" src="/logo.svg" width="30" /></a></h1>

		<nav>
			<ul>
				<li><a href="/uploads">Uploads</a></li>
				<li><a href="/open">Open</a></li>
				<li><a href="/settings">Settings</a></li>
				<li><a href="/api">API</a></li>
				<li><form action="/logout" method="post"><button type="submit">Log out</button></form></li>
			</ul>
		</nav>

	</header>
{/if}

{@render children()}
