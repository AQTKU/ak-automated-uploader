<script lang="ts">
    import FormControl from './FormControl.svelte';

    let { fields, settings } = $props()

</script>

<section id="general">

    <h3>General</h3>

    <div>
        <fieldset>
            {#each fields as field}
                <FormControl
                    {field}
                    value={settings[field.id]}
                />
            {/each}
        </fieldset>
    </div>

</section>