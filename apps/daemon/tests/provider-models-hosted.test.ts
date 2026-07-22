import type http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { startServer } from '../src/server.js';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * The hosted-deployment property for model discovery: a browser holding no
 * credential can still ask which models are available, because the daemon
 * supplies its own key and never echoes it back.
 */
describe('provider model discovery with operator-supplied credentials', () => {
  const realFetch = globalThis.fetch;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OD_BYOK_PROTOCOL;
    delete process.env.OD_BYOK_API_KEY;
    delete process.env.OD_BYOK_BASE_URL;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  function captureUpstream() {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchMock = vi.fn((input: FetchInput, init?: FetchInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      seen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ id: 'gpt-4o', model: 'gpt-4o', status: 'succeeded' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    return seen;
  }

  it('rejects a keyless request when no operator credential is configured', async () => {
    const res = await fetch(`${baseUrl}/api/provider/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 'azure' }),
    });
    expect(res.status).toBe(400);
  });

  it('serves a keyless request from the operator environment', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    const seen = captureUpstream();

    const res = await fetch(`${baseUrl}/api/provider/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 'azure' }),
    });

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok?: boolean; models?: { id: string }[] };
    expect(payload.ok).toBe(true);
    expect(payload.models?.map((m) => m.id)).toEqual(['gpt-4o']);

    const call = seen.at(0);
    if (!call) throw new Error('expected one upstream call');
    expect(call.url).toContain('inova.openai.azure.com');
    expect(call.url).toContain('/openai/deployments');
    expect(call.headers['api-key']).toBe('sk-operator');
  });

  it('never returns the operator key to the client', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    captureUpstream();

    const res = await fetch(`${baseUrl}/api/provider/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 'azure' }),
    });
    expect(await res.text()).not.toContain('sk-operator');
  });

  it('does not lend the azure credential to a different protocol', async () => {
    // An operator who configured Azure must not have that key attached to an
    // Anthropic-shaped discovery request.
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';

    const res = await fetch(`${baseUrl}/api/provider/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 'anthropic' }),
    });
    expect(res.status).toBe(400);
  });

  it('lets a client that brought its own key keep using it', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    const seen = captureUpstream();

    await fetch(`${baseUrl}/api/provider/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocol: 'azure',
        apiKey: 'sk-user-own',
        baseUrl: 'https://mine.openai.azure.com',
      }),
    }).then((r) => r.text());

    const call = seen.at(0);
    if (!call) throw new Error('expected one upstream call');
    expect(call.headers['api-key']).toBe('sk-user-own');
    expect(call.url).toContain('mine.openai.azure.com');
  });
});

/**
 * The "Test" button in Settings hits a different route than discovery, and
 * it had the same gap: it demanded baseUrl + apiKey + model from a browser
 * that, in a hosted deployment, has none of them.
 */
describe('connection test with operator-supplied credentials', () => {
  const realFetch = globalThis.fetch;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OD_BYOK_PROTOCOL;
    delete process.env.OD_BYOK_API_KEY;
    delete process.env.OD_BYOK_BASE_URL;
    delete process.env.OD_BYOK_MODEL;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('no longer demands a key the hosted user cannot have', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    process.env.OD_BYOK_MODEL = 'gpt-5.6-terra';

    vi.stubGlobal(
      'fetch',
      vi.fn((input: FetchInput, init?: FetchInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        return Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    const res = await fetch(`${baseUrl}/api/test/connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'provider', protocol: 'azure' }),
    });

    // The old behaviour was a flat 400 "baseUrl, apiKey, and model are required".
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain('sk-operator');
  });

  it('still rejects a keyless test on a local-first install', async () => {
    const res = await fetch(`${baseUrl}/api/test/connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'provider', protocol: 'azure' }),
    });
    expect(res.status).toBe(400);
  });
});
