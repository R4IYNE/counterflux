// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/edhrec.js';

// ---------------------------------------------------------------------------
// Web Standard fetch handler tests. Inputs are real `Request` objects (from
// the Node 18+ global Request constructor); outputs are real `Response`
// objects. This pins the production behavior — the v1.2 ship-day bug was
// caused by the legacy req/res Node.js handler auto-parsing JSON bodies and
// re-stringifying them with subtly-different bytes that Spellbook's Django
// backend rejected. Web Standard handler forwards the raw body stream.
// ---------------------------------------------------------------------------

function makeRequest({ method = 'GET', path = '', query = '', body = null, headers = {} } = {}) {
  // vercel.json rewrites /api/edhrec/:path* -> /api/edhrec?path=:path*
  const search = new URLSearchParams();
  if (path) search.set('path', path);
  if (query) {
    const extra = new URLSearchParams(query);
    for (const [k, v] of extra.entries()) search.set(k, v);
  }
  const url = `https://counterflux.vercel.app/api/edhrec${search.toString() ? '?' + search.toString() : ''}`;
  return new Request(url, {
    method,
    headers,
    body: body == null || method === 'GET' || method === 'HEAD' ? undefined : body,
    duplex: body ? 'half' : undefined,
  });
}

function mockUpstreamResponse({ status = 200, json = {}, contentType = 'application/json' } = {}) {
  const bodyText = typeof json === 'string' ? json : JSON.stringify(json);
  return new Response(bodyText, {
    status,
    headers: { 'content-type': contentType },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/edhrec handler (Web Standard)', () => {
  it('builds upstream URL from string-form `path` query (production rewrite behavior)', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: { ok: 1 } }));

    const req = makeRequest({ path: 'pages/commanders/atraxa-praetors-voice.json' });
    const res = await handler(req);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://json.edhrec.com/pages/commanders/atraxa-praetors-voice.json'
    );
    expect(res.status).toBe(200);
  });

  it('forwards GET with no body', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ method: 'GET', path: 'pages/top/salt.json' });
    await handler(req);

    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('forwards POST body untouched (raw stream, no parse/re-stringify)', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const bodyJson = '{"foo":"bar","nested":{"a":1}}';
    const req = makeRequest({
      method: 'POST',
      path: 'find',
      body: bodyJson,
      headers: { 'content-type': 'application/json' },
    });
    await handler(req);

    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    // The body forwarded to upstream must be the same byte-stream — verified
    // by reading it back as text.
    const forwardedText = await new Response(init.body).text();
    expect(forwardedText).toBe(bodyJson);
  });

  it('forwards query-string params alongside the path', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ path: 'x', query: 'foo=bar&baz=qux' });
    await handler(req);

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl.startsWith('https://json.edhrec.com/x?')).toBe(true);
    expect(calledUrl).toContain('foo=bar');
    expect(calledUrl).toContain('baz=qux');
    expect(calledUrl).not.toContain('path=');
  });

  it('injects User-Agent verbatim on outbound', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ path: 'pages/top/salt.json' });
    await handler(req);

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get('user-agent')).toBe('Counterflux/1.x (+https://counterflux.vercel.app)');
  });

  it('strips host + Vercel-injected headers from outbound', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({
      path: 'x',
      headers: {
        host: 'counterflux.vercel.app',
        'x-vercel-id': 'dub1::abc123',
        'x-forwarded-for': '1.2.3.4',
        'x-custom': 'keep-me',
      },
    });
    await handler(req);

    const init = fetch.mock.calls[0][1];
    expect(init.headers.has('host')).toBe(false);
    expect(init.headers.has('x-vercel-id')).toBe(false);
    expect(init.headers.has('x-forwarded-for')).toBe(false);
    expect(init.headers.get('x-custom')).toBe('keep-me');
  });

  it('preserves upstream status code on non-2xx responses', async () => {
    fetch.mockResolvedValueOnce(
      mockUpstreamResponse({ status: 404, json: { message: 'not found' } })
    );

    const req = makeRequest({ path: 'pages/commanders/nonexistent.json' });
    const res = await handler(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ message: 'not found' });
  });

  it('returns 502 with `{ error, source: "edhrec" }` on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = makeRequest({ path: 'pages/top/salt.json' });
    const res = await handler(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'upstream unavailable', source: 'edhrec' });
  });

  it('does not throw on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const req = makeRequest({ path: 'x' });
    await expect(handler(req)).resolves.toBeInstanceOf(Response);
  });

  it('exports a function as default', () => {
    expect(typeof handler).toBe('function');
  });
});
