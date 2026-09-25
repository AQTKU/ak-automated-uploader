<script lang="ts">
    import type { SettingsField, SettingsList } from '$lib/types';
    import FormControl from './FormControl.svelte';

    let { fields, settings }: {
        fields: SettingsField[],
        settings: SettingsList,
    } = $props();

</script>

<section id="general">

    <h3>General</h3>

    <div>
        <fieldset>
            {#each fields as field}
                <FormControl
                    {field}
                    value={settings[field.id as keyof SettingsList]}
                />
            {/each}
        </fieldset>
    </div>

</section>