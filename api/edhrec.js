/**
 * Vercel Function: proxy for /api/edhrec/* → https://json.edhrec.com/*
 *
 * Phase 15 — fixes the CloudFront CORS preflight failure that has silently
 * broken EDHREC features in production since v1.0. The Vite dev proxy in
 * vite.config.js:7-12 owns this URL prefix in `npm run dev`; this Function
 * owns it in production. Both serve the same URL shape — src/services/edhrec.js
 * EDHREC_BASE = '/api/edhrec' requires zero changes.
 *
 * Routing: `vercel.json` rewrites `/api/edhrec/:path*` → `/api/edhrec?path=:path*`
 * so the upstream path arrives as a single string query param.
 *
 * Implementation note (hot-fix #3, post-v1.2): switched from Node.js Express-style
 * req/res signature to the Vercel-recommended Web Standard fetch handler. The
 * Node.js style auto-parsed JSON bodies into `req.body`, then re-stringifying
 * for the upstream call produced subtly-different bytes that Spellbook's Django
 * backend rejected with HTTP 400 (verified — direct upstream curl with the same
 * payload returned 200). The Web Standard handler forwards the raw body stream
 * untouched, eliminating the parse/re-serialize round trip.
 *
 * Server-side User-Agent is unrestricted (unlike browsers — see
 * src/services/edhrec.js:42-43). We send a polite `Counterflux/1.x (+url)` UA.
 * NO server-side rate limiting (D-10). NO server-side caching (D-11).
 */

const UPSTREAM_BASE = 'https://json.edhrec.com';
const SOURCE = 'edhrec';
const USER_AGENT = 'Counterflux/1.x (+https://counterflux.vercel.app)';

const STRIP_INBOUND_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'user-agent',
  // Vercel-injected headers that should not leak to upstream
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
    // 1. Build upstream URL from `path` query param (vercel.json rewrite passes
    //    the catch-all suffix here as a single string with slashes).
    const url = new URL(request.url);
    const rawPath = url.searchParams.get('path') || '';
    const segments = rawPath.split('/').filter(Boolean);
    const pathSuffix = segments.map(encodeURIComponent).join('/');

    // Strip `path` from the forwarded query string; everything else passes through.
    const upstreamSearch = new URLSearchParams(url.search);
    upstreamSearch.delete('path');
    const queryString = upstreamSearch.toString();
    const upstreamUrl = `${UPSTREAM_BASE}/${pathSuffix}${queryString ? '?' + queryString : ''}`;

    // 2. Build outbound headers — strip hop-by-hop + Vercel-injected headers.
    const outboundHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (!STRIP_INBOUND_HEADERS.has(k.toLowerCase())) {
        outboundHeaders.set(k, v);
      }
    }
    outboundHeaders.set('User-Agent', USER_AGENT);

    // 3. Make the upstream call. Forward the raw body stream untouched
    //    (no parse/re-serialize round trip — see header comment).
    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers: outboundHeaders,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      // duplex: 'half' is required by Node.js when streaming a request body
      // (silently ignored by browsers; required by undici under Node 18+).
      duplex: 'half',
    });

    // 4. Forward upstream response status + body + headers (minus hop-by-hop).
    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('transfer-encoding');
    respHeaders.delete('content-length');
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  } catch (err) {
    // 5. Network failure / fetch threw → 502 Bad Gateway. Function never crashes (D-13).
    console.error('[api/edhrec] upstream unavailable:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'upstream unavailable', source: SOURCE }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
}
