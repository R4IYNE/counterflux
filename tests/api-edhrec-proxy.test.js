// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/edhrec.js';

// ---------------------------------------------------------------------------
// Mock req/res helpers — small inline utility, no shared fixture.
// Mirrors the shape of Vercel's Node.js Function req/res objects (the bits
// the EDHREC handler actually touches).
// ---------------------------------------------------------------------------
function mockReq({ method = 'GET', path = [], query = {}, body = undefined, headers = {} } = {}) {
  const segments = Array.isArray(path) ? path : [path];
  return {
    method,
    url: '/' + segments.join('/'),
    query: { ...query, path: segments },
    body,
    headers,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _body: null,
    _headers: {},
    status(c) { this.statusCode = c; return this; },
    json(o) { this._body = o; return this; },
    send(b) { this._body = b; return this; },
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; return this; },
    getHeader(k) { return this._headers[k.toLowerCase()]; },
  };
  return res;
}

// Helper: pull the User-Agent header (case-insensitive) from a fetch init object.
function getUA(init) {
  const headers = init?.headers || {};
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'user-agent');
  return entry ? entry[1] : undefined;
}

// Helper: build a Response-like object the handler will await.
function mockUpstreamResponse({ ok = true, status = 200, json = {}, contentType = 'application/json' } = {}) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(typeof json === 'string' ? json : JSON.stringify(json)),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/edhrec handler', () => {
  // ---- Test 1: array-form path -> upstream URL ----
  it('builds the upstream URL from an array-form path slug (legacy/dev mock)', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: { ok: 1 } }));

    const req = mockReq({ path: ['pages', 'commanders', 'prossh-skyraider-of-kher.json'] });
    const res = mockRes();
    await handler(req, res);

    expect(fetch).toHaveBeenCalledTimes(1);
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://json.edhrec.com/pages/commanders/prossh-skyraider-of-kher.json');
  });

  // ---- Test 1b: string-form path (production rewrite behavior) ----
  it('builds the upstream URL from a string-form path slug (production rewrite)', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: { ok: 1 } }));

    // vercel.json `/api/edhrec/:path*` -> `/api/edhrec?path=:path*` rewrites pass
    // path as a single string with embedded slashes — NOT an array. This test
    // pins production behavior so the bug that broke v1.2 ship-day cannot regress.
    const req = {
      method: 'GET',
      url: '/api/edhrec',
      query: { path: 'pages/commanders/atraxa-praetors-voice.json' },
      body: undefined,
      headers: {},
    };
    const res = mockRes();
    await handler(req, res);

    expect(fetch).toHaveBeenCalledTimes(1);
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://json.edhrec.com/pages/commanders/atraxa-praetors-voice.json');
  });

  // ---- Test 2: GET passthrough, no body ----
  it('forwards GET requests with no body', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: { ok: 1 } }));

    const req = mockReq({ method: 'GET', path: ['pages', 'commanders', 'prossh.json'] });
    const res = mockRes();
    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  // ---- Test 3: POST passthrough with JSON-stringified body ----
  it('forwards POST requests with JSON-stringified body', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = mockReq({
      method: 'POST',
      path: ['find-my-combos'],
      body: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
    });
    const res = mockRes();
    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"foo":"bar"}');
    // Inbound content-type should pass through alongside the injected UA.
    const inboundCT = Object.entries(init.headers).find(([k]) => k.toLowerCase() === 'content-type');
    expect(inboundCT?.[1]).toBe('application/json');
  });

  // ---- Test 4: query string passthrough ----
  it('forwards query-string parameters alongside the catch-all path', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = mockReq({ path: ['x'], query: { foo: 'bar', baz: 'qux' } });
    const res = mockRes();
    await handler(req, res);

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl.startsWith('https://json.edhrec.com/x?')).toBe(true);
    expect(calledUrl).toContain('foo=bar');
    expect(calledUrl).toContain('baz=qux');
  });

  // ---- Test 5: UA injection (verbatim string, case-insensitive header lookup) ----
  it('injects User-Agent: Counterflux/1.x (+https://counterflux.vercel.app) on the outbound fetch', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = mockReq({ path: ['pages', 'top', 'salt.json'] });
    const res = mockRes();
    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    const ua = getUA(init);
    expect(ua).toBe('Counterflux/1.x (+https://counterflux.vercel.app)');
  });

  // ---- Test 6: host header strip (with other headers retained) ----
  it('strips the inbound host header from the outbound request', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = mockReq({
      path: ['x'],
      headers: { host: 'counterflux.vercel.app', 'x-custom': 'keep-me' },
    });
    const res = mockRes();
    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    const headerKeys = Object.keys(init.headers).map((k) => k.toLowerCase());
    expect(headerKeys).not.toContain('host');
    // Custom header retained
    const xCustom = Object.entries(init.headers).find(([k]) => k.toLowerCase() === 'x-custom');
    expect(xCustom?.[1]).toBe('keep-me');
  });

  // ---- Test 7: status preservation on non-2xx upstream ----
  it('preserves upstream status code on non-2xx responses', async () => {
    fetch.mockResolvedValueOnce(
      mockUpstreamResponse({ ok: false, status: 404, json: { message: 'not found' } })
    );

    const req = mockReq({ path: ['pages', 'commanders', 'nonexistent.json'] });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res._body).toEqual({ message: 'not found' });
  });

  // ---- Test 8: 502 + verbatim error body on network failure ----
  it('returns 502 with { error: "upstream unavailable", source: "edhrec" } on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = mockReq({ path: ['pages', 'top', 'salt.json'] });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res._body).toEqual({ error: 'upstream unavailable', source: 'edhrec' });
  });

  // ---- Test 9: handler never throws on network failure ----
  it('does not throw when fetch rejects', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const req = mockReq({ path: ['x'] });
    const res = mockRes();
    await expect(handler(req, res)).resolves.toBeUndefined();
  });

  // ---- Test 10: handler signature ----
  it('exports a function as default', () => {
    expect(typeof handler).toBe('function');
  });
});
