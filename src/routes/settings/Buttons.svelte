<script lang="ts">

    const { resetAuthTokenFormVisible, toggleResetAuthTokenForm }: {
        resetAuthTokenFormVisible: boolean,
        toggleResetAuthTokenForm?: () => void
    } = $props();

</script>

<p class="buttons">
    {#if resetAuthTokenFormVisible}
        <button type="submit">💾 Save</button>
        {#if toggleResetAuthTokenForm}
            <button type="button" onclick={toggleResetAuthTokenForm}>⚙️ App settings</button>
        {/if}
    {:else}
        <button type="submit">💾 Save</button>
        {#if toggleResetAuthTokenForm}
            <button type="button" onclick={toggleResetAuthTokenForm}>🔒 Login token settings</button>
        {/if}
    {/if}
</p>