// Cloudflare Pages Function: list revolutionary-art images from the R2 bucket.
// The public R2 domain cannot list directories, so this endpoint uses an R2
// binding when the Pages project provides one. The static page falls back to
// /data/革命文艺/美术图片.json when no binding is configured.

const PREFIX = '革命文艺/美术图片/';
const CATEGORIES = ['雕塑', '绘画', '年画', '宣传画'];
const BINDING_NAMES = ['ART_BUCKET', 'R2_ART', 'R2_BUCKET', 'R2', 'BUCKET'];

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

function getBucket(env) {
    for (const name of BINDING_NAMES) {
        const bucket = env && env[name];
        if (bucket && typeof bucket.list === 'function') return bucket;
    }
    return null;
}

export async function onRequestGet(context) {
    const bucket = getBucket(context.env);
    if (!bucket) {
        return jsonResponse({
            error: 'R2 binding missing',
            images: []
        }, 501);
    }

    const objects = [];
    let cursor;

    try {
        do {
            const page = await bucket.list({ prefix: PREFIX, cursor, limit: 1000 });
            objects.push(...(page.objects || []));
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
    } catch (error) {
        return jsonResponse({ error: 'R2 listing failed', images: [] }, 502);
    }

    const images = [];
    for (const object of objects) {
        const key = String(object.key || '');
        const rest = key.slice(PREFIX.length);
        const parts = rest.split('/');
        const category = parts[0];
        if (parts.length < 2 || CATEGORIES.indexOf(category) === -1) continue;
        if (!/\.(webp|wepb)$/i.test(key)) continue;
        images.push({
            category,
            name: parts[parts.length - 1],
            key
        });
    }

    images.sort((a, b) => {
        const categoryDiff = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
        return categoryDiff || a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    });

    return jsonResponse({ images, count: images.length }, 200, 'public, max-age=300');
}
