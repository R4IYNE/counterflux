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
 * so the upstream path arrives as a single string in `req.query.path` (e.g.
 * `'pages/commanders/atraxa.json'`). Split on `/` to reconstruct the upstream
 * URL. The original `[...path]` Next.js-style filename was abandoned in the
 * Phase 15 hot-fix because Vercel doesn't apply Next.js routing to vanilla
 * Vite projects — `[...path]` only matched single-segment paths in production.
 *
 * Server-side User-Agent is unrestricted (unlike browsers — see
 * src/services/edhrec.js:42-43). We send a polite `Counterflux/1.x (+url)`
 * UA so EDHREC ops can identify and contact us.
 *
 * NO server-side rate limiting (D-10 — client enforces 200ms spacing).
 * NO server-side caching (D-11 — client caches 7d via Dexie + meta table).
 * Method, query, body, headers pass through transparently except UA replacement.
 */

const UPSTREAM_BASE = 'https://json.edhrec.com';
const SOURCE = 'edhrec';
const USER_AGENT = 'Counterflux/1.x (+https://counterflux.vercel.app)';

export default async function handler(req, res) {
  try {
    // 1. Build upstream URL from `req.query.path` + remaining query params.
    //    Production: rewrite passes path as a single string with slashes
    //    (`'pages/commanders/prossh.json'`). Dev/test mocks may pass an array
    //    (`['pages', 'commanders', 'prossh.json']`). Both forms reduce to the
    //    same segment list.
    const rawPath = req.query.path;
    const segments = Array.isArray(rawPath)
      ? rawPath
      : (rawPath ? String(rawPath).split('/').filter(Boolean) : []);
    const pathSuffix = segments.map(encodeURIComponent).join('/');

    // Strip `path` from the query, serialize the rest into a query string.
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

    // 2. Build outbound fetch init.
    //    - Pass method through.
    //    - Strip `host` (Node would otherwise send the wrong host downstream).
    //    - Strip `connection` (Node fetch sets its own).
    //    - Replace UA with our server-side string (browsers can't set UA so
    //      the inbound headers won't have one in normal flow, but we still
    //      overwrite defensively).
    const outboundHeaders = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      const lower = k.toLowerCase();
      // Strip hop-by-hop headers + content-length (re-stringifying req.body can
      // change the byte length; let Node's fetch compute it from init.body).
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
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.body !== undefined &&
      req.body !== null
    ) {
      // Vercel auto-parses JSON bodies — re-stringify for the upstream call.
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // 3. Make the upstream call.
    const upstreamRes = await fetch(upstreamUrl, init);

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
    // 5. Network failure / fetch threw → 502 Bad Gateway.
    //    Function never crashes (D-13).
    console.error('[api/edhrec] upstream unavailable:', err?.message || err);
    res.status(502).json({ error: 'upstream unavailable', source: SOURCE });
  }
}
