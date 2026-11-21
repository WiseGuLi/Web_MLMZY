// Cloudflare Pages Function: list revolutionary-art images from Backblaze B2.
// B2's public download domain cannot list folders, so this endpoint uses the
// B2 Native API when the Pages project provides B2_KEY_ID, B2_APPLICATION_KEY
// and B2_BUCKET_ID. The static page falls back to
// /data/革命文艺/美术图片.json when those variables are not configured.

const PREFIX = '革命文艺/美术图片/';
const CATEGORIES = ['雕塑', '绘画', '年画', '宣传画'];
const AUTH_URL = 'https://api.backblazeb2.com/b2api/v3/b2_authorize_account';

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

function basicAuth(keyId, appKey) {
    return 'Basic ' + btoa(keyId + ':' + appKey);
}

async function b2Request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        let message = 'B2 HTTP ' + response.status;
        try {
            const detail = await response.json();
            if (detail && detail.message) message += ': ' + detail.message;
        } catch (error) {
            // Keep the status-only message when B2 returns a non-JSON body.
        }
        throw new Error(message);
    }
    return response.json();
}

export async function onRequestGet(context) {
    const env = context.env || {};
    const keyId = env.B2_KEY_ID;
    const appKey = env.B2_APPLICATION_KEY;
    const bucketId = env.B2_BUCKET_ID;

    if (!keyId || !appKey || !bucketId) {
        return jsonResponse({ error: 'B2 credentials missing', images: [] }, 501);
    }

    let auth;
    try {
        auth = await b2Request(AUTH_URL, {
            headers: { Authorization: basicAuth(keyId, appKey) }
        });
    } catch (error) {
        return jsonResponse({ error: 'B2 authorization failed', images: [] }, 502);
    }

    const apiUrl = auth && auth.apiInfo && auth.apiInfo.storageApi && auth.apiInfo.storageApi.apiUrl;
    const token = auth && auth.authorizationToken;
    if (!apiUrl || !token) {
        return jsonResponse({ error: 'B2 authorization response invalid', images: [] }, 502);
    }

    const files = [];
    let startFileName;

    try {
        do {
            const page = await b2Request(apiUrl + '/b2api/v3/b2_list_file_names', {
                method: 'POST',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bucketId,
                    startFileName,
                    prefix: PREFIX,
                    maxFileCount: 1000
                })
            });

            files.push(...(page.files || []));
            startFileName = page.nextFileName || undefined;
        } while (startFileName);
    } catch (error) {
        return jsonResponse({ error: 'B2 listing failed', images: [] }, 502);
    }

    const images = [];
    for (const file of files) {
        const key = String(file.fileName || '');
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
