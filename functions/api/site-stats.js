// Cloudflare Pages Function: proxy LibreCounter site statistics.
// LibreCounter does not send CORS headers, so the browser requests this
// same-origin endpoint instead of calling the stats API directly.

const STATS_ORIGIN = 'https://librecounter.org';
const SITE = 'www.mlmzy.org';
const ALLOWED_DAYS = [7, 14, 30];
const DEFAULT_DAYS = 30;

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

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const rawDays = Number.parseInt(url.searchParams.get('days') || '', 10);
    const days = ALLOWED_DAYS.includes(rawDays) ? rawDays : DEFAULT_DAYS;
    const target = `${STATS_ORIGIN}/${SITE}/siteStats?days=${days}`;

    let upstream;
    try {
        upstream = await fetch(target, {
            headers: {
                Accept: 'application/json'
            }
        });
    } catch (error) {
        return jsonResponse({ error: 'Stats service unavailable' }, 502);
    }

    if (!upstream.ok) {
        return jsonResponse({ error: 'Stats service HTTP ' + upstream.status }, 502);
    }

    let payload;
    try {
        payload = await upstream.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid stats response' }, 502);
    }

    return jsonResponse(payload, 200, 'public, max-age=300, s-maxage=300');
}
