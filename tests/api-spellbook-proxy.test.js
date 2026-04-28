// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/spellbook.js';

function makeRequest({ method = 'GET', path = '', query = '', body = null, headers = {} } = {}) {
  const search = new URLSearchParams();
  if (path) search.set('path', path);
  if (query) {
    const extra = new URLSearchParams(query);
    for (const [k, v] of extra.entries()) search.set(k, v);
  }
  const url = `https://counterflux.vercel.app/api/spellbook${search.toString() ? '?' + search.toString() : ''}`;
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

describe('api/spellbook handler (Web Standard)', () => {
  it('forwards POST /find-my-combos with the JSON body byte-stream untouched', async () => {
    fetch.mockResolvedValueOnce(
      mockUpstreamResponse({
        status: 200,
        json: { results: { included: [], almostIncluded: [] } },
      })
    );

    const reqBodyText = JSON.stringify({
      commanders: [{ card: 'Atraxa, Praetors’ Voice' }],
      main: [{ card: 'Sol Ring' }],
    });
    const req = makeRequest({
      method: 'POST',
      path: 'find-my-combos',
      body: reqBodyText,
      headers: { 'content-type': 'application/json' },
    });
    const res = await handler(req);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://backend.commanderspellbook.com/find-my-combos'
    );
    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    // Critical assertion — the bytes forwarded to upstream are byte-identical
    // to what came in. This pins the v1.2 ship-day Spellbook bug fix.
    const forwardedText = await new Response(init.body).text();
    expect(forwardedText).toBe(reqBodyText);
    expect(res.status).toBe(200);
  });

  it('builds upstream URL from string-form `path` query (production rewrite behavior)', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ method: 'GET', path: 'variants' });
    await handler(req);

    expect(fetch.mock.calls[0][0]).toBe('https://backend.commanderspellbook.com/variants');
  });

  it('injects User-Agent verbatim on outbound', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ method: 'GET', path: 'variants' });
    await handler(req);

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get('user-agent')).toBe('Counterflux/1.x (+https://counterflux.vercel.app)');
  });

  it('strips host + Vercel-injected headers from outbound', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({
      method: 'GET',
      path: 'variants',
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

  it('forwards query-string params alongside the path', async () => {
    fetch.mockResolvedValueOnce(mockUpstreamResponse({ json: {} }));

    const req = makeRequest({ method: 'GET', path: 'variants', query: 'foo=bar' });
    await handler(req);

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('foo=bar');
    expect(calledUrl).not.toContain('path=');
  });

  it('preserves upstream status code on non-2xx responses', async () => {
    fetch.mockResolvedValueOnce(
      mockUpstreamResponse({ status: 503, json: { error: 'service unavailable' } })
    );

    const req = makeRequest({ method: 'GET', path: 'variants' });
    const res = await handler(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'service unavailable' });
  });

  it('returns 502 with `{ error, source: "spellbook" }` on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const req = makeRequest({
      method: 'POST',
      path: 'find-my-combos',
      body: '{"commanders":[],"main":[]}',
      headers: { 'content-type': 'application/json' },
    });
    const res = await handler(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'upstream unavailable', source: 'spellbook' });
  });

  it('symmetry-breaker — does NOT leak `edhrec` source string', async () => {
    fetch.mockRejectedValueOnce(new Error('upstream down'));

    const req = makeRequest({ method: 'GET', path: 'variants' });
    const res = await handler(req);

    const body = await res.json();
    expect(body.source).toBe('spellbook');
    expect(body.source).not.toBe('edhrec');
    // Sanity: ensure no copy-paste leak across the function boundary
    expect(JSON.stringify(body)).not.toContain('edhrec');
  });

  it('does not throw on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const req = makeRequest({ method: 'GET', path: 'variants' });
    await expect(handler(req)).resolves.toBeInstanceOf(Response);
  });

  it('exports a function as default', () => {
    expect(typeof handler).toBe('function');
  });
});
