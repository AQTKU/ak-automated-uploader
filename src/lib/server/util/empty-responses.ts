/* A fresh Response each time, since SvelteKit adds Set-Cookie headers to whatever
   is returned and a shared instance would collect them across requests */
export const noContent = () => new Response(null, { status: 204 });
export const accepted = () => new Response(null, { status: 202 });
