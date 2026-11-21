// Cloudflare Pages Function: proxy the B2 directory-listing Worker.
// The Worker only allows the production site origin, so the browser calls this
// same-origin endpoint instead of the Worker directly.

const LIST_URL = 'https://b2-list.wise-gulily.workers.dev/';
const PREFIX = '革命文艺/美术图片/';
const CATEGORIES = ['雕塑', '绘画', '年画', '宣传画'];

function jsonResponse(data, status = 200, cache = 'no-store') {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': cache,
            'X-Content-Type-Options': 'nosniff'
        }
    });
}

export async function onRequestGet() {
    let payload;
    try {
        const response = await fetch(LIST_URL + '?prefix=' + encodeURIComponent(PREFIX), {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            return jsonResponse({ error: 'B2 listing HTTP ' + response.status, images: [] }, 502);
        }
        payload = await response.json();
    } catch (error) {
        return jsonResponse({ error: 'B2 listing unavailable', images: [] }, 502);
    }

    const list = Array.isArray(payload)
        ? payload
        : (payload && (payload.files || payload.objects)) || [];

    const images = [];
    for (const item of list) {
        const name = String((item && item.name) || '');
        const rest = name.slice(PREFIX.length);
        const parts = rest.split('/');
        const category = parts[0];
        if (parts.length < 2 || CATEGORIES.indexOf(category) === -1) continue;
        if (!/\.(webp|wepb)$/i.test(name)) continue;
        images.push({
            category,
            name: parts[parts.length - 1],
            key: name,
            url: item.url || ''
        });
    }

    images.sort((a, b) => {
        const categoryDiff = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
        return categoryDiff || a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    });

    return jsonResponse({ images, count: images.length }, 200, 'public, max-age=300');
}
