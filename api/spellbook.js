/**
 * Vercel Function: proxy for /api/spellbook/* → https://backend.commanderspellbook.com/*
 *
 * Phase 15 (D-04 Spellbook parity) — same CORS-preflight problem as the EDHREC
 * proxy at api/edhrec.js. The Vite dev proxy in vite.config.js:13-17 owns this
 * URL prefix in `npm run dev`; this Function owns it in production. Both serve
 * the same URL shape — src/services/spellbook.js SPELLBOOK_BASE = '/api/spellbook'
 * requires zero changes.
 *
 * Routing: `vercel.json` rewrites `/api/spellbook/:path*` → `/api/spellbook?path=:path*`.
 *
 * Implementation note (hot-fix #3, post-v1.2): Web Standard fetch handler. See
 * `api/edhrec.js` header for the full rationale — Spellbook's Django backend
 * specifically required the raw body byte-stream pass-through that req/res
 * style auto-parsing was destroying.
 *
 * Only call site today: POST /find-my-combos with a JSON body shaped as
 * { commanders: [{card: name}, ...], main: [{card: name}, ...] }
 * (see src/services/spellbook.js:37-48). The Function is upstream-agnostic
 * — same passthrough handles any future endpoints.
 */

const UPSTREAM_BASE = 'https://backend.commanderspellbook.com';
const SOURCE = 'spellbook';
const USER_AGENT = 'Counterflux/1.x (+https://counterflux.vercel.app)';

const STRIP_INBOUND_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'user-agent',
  'x-vercel-id',
  'x-vercel-deployment-url',
  'x-vercel-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
]);

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const rawPath = url.searchParams.get('path') || '';
    const segments = rawPath.split('/').filter(Boolean);
    const pathSuffix = segments.map(encodeURIComponent).join('/');

    const upstreamSearch = new URLSearchParams(url.search);
    upstreamSearch.delete('path');
    const queryString = upstreamSearch.toString();
    const upstreamUrl = `${UPSTREAM_BASE}/${pathSuffix}${queryString ? '?' + queryString : ''}`;

    const outboundHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (!STRIP_INBOUND_HEADERS.has(k.toLowerCase())) {
        outboundHeaders.set(k, v);
      }
    }
    outboundHeaders.set('User-Agent', USER_AGENT);

    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers: outboundHeaders,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      duplex: 'half',
    });

    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('transfer-encoding');
    respHeaders.delete('content-length');
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  } catch (err) {
    console.error('[api/spellbook] upstream unavailable:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'upstream unavailable', source: SOURCE }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
}
