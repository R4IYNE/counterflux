// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/spellbook/[...path].js';

// --- Mock req/res helpers (intentional inline duplication — see Plan 15-02 <interfaces>).
function mockReq({ method = 'GET', path = [], query = {}, body = undefined, headers = {} } = {}) {
  return {
    method,
    url: '/' + (Array.isArray(path) ? path.join('/') : path),
    query: { ...query, path: Array.isArray(path) ? path : [path] },
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

// Look up a header by lower-case key, regardless of how the producer cased it.
function findHeaderCaseInsensitive(headers, name) {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/spellbook/[...path] handler', () => {
  it('forwards POST /find-my-combos with the JSON-stringified body', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ results: { included: [], almostIncluded: [] } }),
    });

    const reqBody = {
      commanders: [{ card: 'Prossh, Skyraider of Kher' }],
      main: [{ card: 'Sol Ring' }],
    };
    const req = mockReq({
      method: 'POST',
      path: ['find-my-combos'],
      body: reqBody,
      headers: { 'content-type': 'application/json' },
    });
    const res = mockRes();

    await handler(req, res);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://backend.commanderspellbook.com/find-my-combos');
    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(reqBody);
    expect(res.statusCode).toBe(200);
  });

  it('builds the upstream URL from the catch-all path slug', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({ method: 'GET', path: ['variants'] });
    const res = mockRes();

    await handler(req, res);

    expect(fetch.mock.calls[0][0]).toBe('https://backend.commanderspellbook.com/variants');
  });

  it('forwards GET requests with no body', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({ method: 'GET', path: ['variants'] });
    const res = mockRes();

    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('forwards query-string parameters alongside the catch-all path', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({ method: 'GET', path: ['x'], query: { foo: 'bar' } });
    const res = mockRes();

    await handler(req, res);

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('https://backend.commanderspellbook.com/x');
    expect(url).toContain('foo=bar');
  });

  it('injects User-Agent: Counterflux/1.x (+https://counterflux.vercel.app) on the outbound fetch', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({ method: 'GET', path: ['variants'] });
    const res = mockRes();

    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    const ua = findHeaderCaseInsensitive(init.headers, 'User-Agent');
    expect(ua).toBe('Counterflux/1.x (+https://counterflux.vercel.app)');
  });

  it('preserves the inbound Content-Type header on the outbound request', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({
      method: 'POST',
      path: ['find-my-combos'],
      body: { commanders: [], main: [] },
      headers: { 'content-type': 'application/json' },
    });
    const res = mockRes();

    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    const ct = findHeaderCaseInsensitive(init.headers, 'content-type');
    expect(ct).toBe('application/json');
  });

  it('strips the inbound host header from the outbound request', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    const req = mockReq({
      method: 'GET',
      path: ['variants'],
      headers: { host: 'counterflux.vercel.app', 'x-trace': 'abc' },
    });
    const res = mockRes();

    await handler(req, res);

    const init = fetch.mock.calls[0][1];
    expect(findHeaderCaseInsensitive(init.headers, 'host')).toBeUndefined();
    expect(findHeaderCaseInsensitive(init.headers, 'x-trace')).toBe('abc');
  });

  it('preserves upstream status code on non-2xx responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ message: 'server error' }),
    });

    const req = mockReq({ method: 'GET', path: ['variants'] });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._body).toEqual({ message: 'server error' });
  });

  it('returns 502 with { error: "upstream unavailable", source: "spellbook" } on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ENOTFOUND'));

    const req = mockReq({
      method: 'POST',
      path: ['find-my-combos'],
      body: { commanders: [], main: [] },
      headers: { 'content-type': 'application/json' },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(502);
    // Symmetry-breaker: source MUST be 'spellbook' (lowercase), NOT 'edhrec'.
    expect(res._body).toEqual({ error: 'upstream unavailable', source: 'spellbook' });
  });

  it('does not throw when fetch rejects', async () => {
    fetch.mockRejectedValueOnce(new Error('connection reset'));

    const req = mockReq({ method: 'GET', path: ['variants'] });
    const res = mockRes();

    await expect(handler(req, res)).resolves.toBeUndefined();
    expect(res.statusCode).toBe(502);
  });
});
