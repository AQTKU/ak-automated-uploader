<script lang="ts">

    let { screenshots } = $props();

    function makeSrcSet(id: string, widths: number[] = [100, 200, 300, 400, 500]) {
        const sources = widths.map(width => `/screenshots/${id}?w=${width} ${width}w`);
        return sources.join(', ');
    }

</script>

<section id="screenshots">

    <h3>Screenshots</h3>

    <ul>
        {#each screenshots as id}
            <li>
                <a href="/screenshots/{id}">
                    <img
                        alt="Screenshot" 
                        srcset={makeSrcSet(id)}
                        src="/screenshots/{id}?w=300"
                    >
                </a>
            </li>
        {/each}
    </ul>

</section>