import type { FieldLayout } from '$lib/types';

export default function buildGridTemplateArea(layout: FieldLayout) {

    const width = Math.max(...layout.map(row => row.length));
    if (!width) return;

    // Takes ['one', 'two', 'three'][] and transforms it to '"one two three" "..."'

    return layout
        .map(row => `"${Array.from({ length: width }, (_, i) => row[i] ?? '.').join(' ')}"`)
        .join(' ');

}
