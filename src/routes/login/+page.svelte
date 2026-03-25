<script lang="ts">
    import type { PageProps } from './$types';

    const { data, form }: PageProps = $props();
    // svelte-ignore state_referenced_locally
    const { authToken } = data;
    // svelte-ignore state_referenced_locally
    const error = form?.error;

    let copyTimeout: ReturnType<typeof setTimeout> | undefined;
    let copyState: string | null = $state(null);

    async function copy() {

        if (!authToken) return;

        try {
            await navigator.clipboard.writeText(authToken);
            copyState = 'success';
        } catch {
            copyState = 'error';
        }

        if (copyTimeout) clearTimeout(copyTimeout);
        copyTimeout = setTimeout(() => { copyState = null; }, 2000);

    }

    function select(event: FocusEvent) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        target.select();
    }

</script>

<svelte:head>
    <title>Login - AK Automated Uploader</title>
</svelte:head>

<header id="login-header">
    <img src="/logo.svg" alt="AK Automated Uploader logo" width="150">
    <h1>AK Automated Uploader</h1>
</header>

<main id="login">

    <h2>Login</h2>

    {#if authToken}
        <section class="auth-token">

            <p>Keep this token in a safe place. Use it below to log in. After you log in, it won't be shown to you again.</p>

            <p class="token">
                <input type="text" readonly value={authToken} onfocus={select}>
                <button type="button" onclick={copy}>
                    {#if copyState === 'success'}
                        ✅ Copied
                    {:else if copyState === 'error'}
                        ❌ Failed
                    {:else}
                        📋 Copy
                    {/if}
                </button>
            </p>

        </section>
    {/if}

    <section class="login">

        <form action="" method="post">

            {#if error}
                <p class="error">❌ {error}</p>
            {/if}
    
            <p>
                <label for="login-token">Login token:</label>
                <input type="password" id="login-token" name="password" autocomplete="current-password">
            </p>

            <p><button type="submit">🔑 Log in</button></p>
        
        </form>

    </section>

</main>