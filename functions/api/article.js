// Cloudflare Pages Function: proxy Markdown articles from R2.
// R2's public domain does not send CORS headers for browser fetch, so the
// article page requests this same-origin endpoint instead.

const R2_ORIGIN = 'https://files.mlmzy.org';

function textResponse(message, status) {
    return new Response(message, {
        status,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

function isUnsafePart(value) {
    return !value || value === '.' || value === '..' || /[/\\\u0000-\u001f]/.test(value);
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const category = (url.searchParams.get('category') || '').trim();
    const rawName = (url.searchParams.get('name') || '').trim();
    const name = rawName.replace(/\.md$/i, '');

    if (!category || !name) {
        return textResponse('缺少文章分类或文章名。', 400);
    }

    if (category.length > 200 || name.length > 300 ||
        isUnsafePart(category) || isUnsafePart(name)) {
        return textResponse('文章路径不合法。', 400);
    }

    const target = R2_ORIGIN + '/' + ['文章', category, name + '.md']
        .map((part) => encodeURIComponent(part))
        .join('/');

    let upstream;
    try {
        upstream = await fetch(target, {
            headers: {
                Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8'
            }
        });
    } catch (error) {
        return textResponse('无法连接文章存储。', 502);
    }

    if (!upstream.ok) {
        return textResponse('文章正文不存在。', upstream.status === 404 ? 404 : 502);
    }

    const body = await upstream.text();
    return new Response(body, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}
