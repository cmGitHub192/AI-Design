import type http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { startServer } from '../src/server.js';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * The hosted-deployment property: a browser that holds no credential can
 * still reach Azure, because the daemon supplies the key from its own
 * environment and never echoes it back.
 */
describe('azure proxy with operator-supplied credentials', () => {
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

  function captureUpstream() {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchMock = vi.fn((input: FetchInput, init?: FetchInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push({ url, headers });
      return Promise.resolve(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    return seen;
  }

  it('rejects a keyless request when no operator credential is configured', async () => {
    const res = await fetch(`${baseUrl}/api/proxy/azure/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    });
    expect(res.status).toBe(400);
  });

  it('serves a keyless request from the operator environment', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    process.env.OD_BYOK_MODEL = 'gpt-4o';
    const seen = captureUpstream();

    const res = await fetch(`${baseUrl}/api/proxy/azure/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    });

    expect(res.status).toBe(200);
    await res.text();
    expect(seen).toHaveLength(1);
    const upstream = seen.at(0);
    if (!upstream) throw new Error('expected one upstream call');
    expect(upstream.url).toContain('inova.openai.azure.com');
    expect(upstream.url).toContain('/openai/deployments/gpt-4o/chat/completions');
    expect(upstream.headers['api-key']).toBe('sk-operator');
  });

  it('never returns the operator key to the client', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    process.env.OD_BYOK_MODEL = 'gpt-4o';
    captureUpstream();

    const res = await fetch(`${baseUrl}/api/proxy/azure/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    });
    const body = await res.text();
    expect(body).not.toContain('sk-operator');
  });

  it('lets a client that brought its own key keep using it', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    const seen = captureUpstream();

    await fetch(`${baseUrl}/api/proxy/azure/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'sk-user-own',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hola' }],
      }),
    }).then((r) => r.text());

    const upstream = seen.at(0);
    if (!upstream) throw new Error('expected one upstream call');
    expect(upstream.headers['api-key']).toBe('sk-user-own');
  });
});
