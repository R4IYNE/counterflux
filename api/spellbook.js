/**
 * Vercel Function: proxy for /api/spellbook/* → https://backend.commanderspellbook.com/*
 *
 * Phase 15 (D-04 Spellbook parity) — same CORS-preflight problem as the
 * EDHREC proxy at api/edhrec.js. The Vite dev proxy in vite.config.js:13-17
 * owns this URL prefix in `npm run dev`; this Function owns it in production.
 * Both serve the same URL shape — src/services/spellbook.js
 * SPELLBOOK_BASE = '/api/spellbook' requires zero changes.
 *
 * Routing: `vercel.json` rewrites `/api/spellbook/:path*` → `/api/spellbook?path=:path*`
 * so the upstream path arrives as a single string in `req.query.path`. See
 * `api/edhrec.js` header for why catch-all `[...path]` filenames don't work
 * for vanilla Vite projects on Vercel.
 *
 * Only call site today: POST /find-my-combos with a JSON body shaped as
 * { commanders: [{card: name}, ...], main: [{card: name}, ...] }
 * (see src/services/spellbook.js:37-48). The Function is upstream-agnostic
 * — same passthrough handles GETs and any future endpoints.
 *
 * Server-side User-Agent is unrestricted (unlike browsers). NO server-side
 * rate limiting (D-10). NO server-side caching (D-11 — client caches via
 * Dexie combo_cache table per src/stores/intelligence.js:148-149).
 */

const UPSTREAM_BASE = 'https://backend.commanderspellbook.com';
const SOURCE = "spellbook";
const USER_AGENT = 'Counterflux/1.x (+https://counterflux.vercel.app)';

export default async function handler(req, res) {
  try {
    // 1. Build upstream URL from `req.query.path` + remaining query params.
    //    Production: rewrite passes path as a single string with slashes.
    //    Dev/test mocks may pass an array. Both forms reduce to the same segments.
    const rawPath = req.query.path;
    const segments = Array.isArray(rawPath)
      ? rawPath
      : (rawPath ? String(rawPath).split('/').filter(Boolean) : []);
    const pathSuffix = segments.map(encodeURIComponent).join('/');
    const { path: _ignored, ...queryRest } = req.query;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(queryRest)) {
      if (Array.isArray(v)) {
        for (const item of v) qs.append(k, item);
      } else if (v !== undefined && v !== null) {
        qs.append(k, String(v));
      }
    }
    const queryString = qs.toString();
    const upstreamUrl = `${UPSTREAM_BASE}/${pathSuffix}${queryString ? '?' + queryString : ''}`;

    // 2. Build outbound fetch init. Strip hop-by-hop headers + content-length
    //    (re-stringifying req.body can change the byte length; let Node's fetch
    //    compute it from init.body) + accept-encoding (Vercel may auto-decompress
    //    inbound, so the stored body is already plain). Inject our server UA.
    const outboundHeaders = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      const lower = k.toLowerCase();
      if (
        lower === 'host' ||
        lower === 'connection' ||
        lower === 'user-agent' ||
        lower === 'content-length' ||
        lower === 'accept-encoding'
      ) {
        continue;
      }
      outboundHeaders[k] = v;
    }
    outboundHeaders['User-Agent'] = USER_AGENT;

    const init = {
      method: req.method,
      headers: outboundHeaders,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined && req.body !== null) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // === DEBUG INSTRUMENTATION (temp — Phase 15 hot-fix #4 diagnosis) ===
    // Logs everything we send to upstream so we can compare against a known-good
    // direct-curl request. Remove once Spellbook 400 is diagnosed and fixed.
    console.error('[spellbook-debug] method:', req.method);
    console.error('[spellbook-debug] inbound req.body typeof:', typeof req.body);
    console.error('[spellbook-debug] inbound req.body keys:', req.body && typeof req.body === 'object' ? Object.keys(req.body) : '(not object)');
    console.error('[spellbook-debug] inbound req.body sample:', JSON.stringify(req.body).slice(0, 500));
    console.error('[spellbook-debug] outbound URL:', upstreamUrl);
    console.error('[spellbook-debug] outbound headers:', JSON.stringify(outboundHeaders));
    if (init.body !== undefined) {
      const bodyStr = typeof init.body === 'string' ? init.body : String(init.body);
      console.error('[spellbook-debug] outbound body bytes:', Buffer.byteLength(bodyStr, 'utf-8'));
      console.error('[spellbook-debug] outbound body content:', bodyStr.slice(0, 500));
    }
    // === END DEBUG ===

    // 3. Make the upstream call.
    const upstreamRes = await fetch(upstreamUrl, init);

    // === DEBUG: log upstream response ===
    console.error('[spellbook-debug] upstream status:', upstreamRes.status);
    console.error('[spellbook-debug] upstream content-type:', upstreamRes.headers.get('content-type'));
    // === END DEBUG ===

    // 4. Forward status + body unchanged.
    const contentType = upstreamRes.headers.get('content-type') || '';
    res.status(upstreamRes.status);
    if (contentType.includes('application/json')) {
      const data = await upstreamRes.json();
      res.json(data);
    } else {
      const text = await upstreamRes.text();
      res.setHeader('content-type', contentType || 'text/plain');
      res.send(text);
    }
  } catch (err) {
    // 5. Network failure → 502 Bad Gateway. Function never crashes (D-13).
    console.error('[api/spellbook] upstream unavailable:', err?.message || err);
    res.status(502).json({ error: 'upstream unavailable', source: SOURCE });
  }
}
