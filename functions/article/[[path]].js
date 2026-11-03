// Cloudflare Pages Function: keep /article/* client-side routes on the article page.
// The site has no physical category/article folders, so a direct visit must be
// rewritten to the article app while preserving the browser URL.
export async function onRequest(context) {
    const assetUrl = new URL('/article/', context.request.url);
    const request = new Request(assetUrl, context.request);
    return context.env.ASSETS.fetch(request);
}
