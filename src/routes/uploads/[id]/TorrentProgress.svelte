<script lang="ts">
    let { progress } = $props();
    let value = $derived(progress || undefined);
</script>

<section id="torrent-progress">
    <h3>Torrent Progress</h3>
    <progress {value} max="100"></progress>
</section>