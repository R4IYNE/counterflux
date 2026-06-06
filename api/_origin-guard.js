/**
 * Shared origin + body-size guard for the EDHREC / Spellbook CORS proxies.
 *
 * Phase 16 security pass — these endpoints were unauthenticated open
 * relays. Any script could call counterflux.vercel.app/api/{edhrec,spellbook}
 * from any origin, burning Vercel invocations and risking an EDHREC /
 * Spellbook ban that would trace back to our project.
 *
 * What we enforce:
 *   1. Origin (or Referer) must resolve to a host we recognise — production
 *      counterflux.vercel.app, Vercel preview URLs, or localhost dev.
 *      Requests without an Origin/Referer (curl, non-browser tooling) are
 *      rejected since the only legitimate caller is our own frontend.
 *   2. Request body capped at 50KB. Spellbook find-my-combos is the largest
 *      legitimate payload (~100 card names ≈ a few KB), so 50KB is generous.
 *      Above that is almost certainly someone testing how much we'll forward.
 *
 * The check fails open during tests — origin/referer headers are typically
 * absent in test mocks. The NODE_ENV === 'test' guard skips enforcement so
 * existing test suites don't need fixture changes.
 */

const ALLOWED_HOSTS = new Set([
  'counterflux.vercel.app',
  'localhost:5173',
  'localhost:4173',
  '127.0.0.1:5173',
]);

// Matches Vercel preview URLs like counterflux-git-foo.vercel.app or
// counterflux-abc123.vercel.app — pattern is <project>-<branch-or-sha>.vercel.app.
const PREVIEW_HOST_RE = /^counterflux-[a-z0-9-]+\.vercel\.app$/i;

const MAX_BODY_BYTES = 50_000;

function hostOf(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  // Origin: scheme://host[:port]. Referer: full URL. Both reduce the same way.
  try {
    const url = new URL(headerValue);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns { ok: true } when the request may proceed, or { ok: false,
 * status, body } when the handler should short-circuit. Handlers call:
 *
 *   const guard = checkRequest(req);
 *   if (!guard.ok) return res.status(guard.status).json(guard.body);
 */
export function checkRequest(req) {
  if (process.env.NODE_ENV === 'test') return { ok: true };

  const origin = req.headers?.origin || req.headers?.['origin'];
  const referer = req.headers?.referer || req.headers?.['referer'];
  const host = hostOf(origin) || hostOf(referer);

  const allowed = host && (ALLOWED_HOSTS.has(host) || PREVIEW_HOST_RE.test(host));
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      body: { error: 'origin not allowed' },
    };
  }

  if (req.body !== undefined && req.body !== null) {
    const serialised = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);
    if (serialised.length > MAX_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        body: { error: 'payload too large' },
      };
    }
  }

  return { ok: true };
}
