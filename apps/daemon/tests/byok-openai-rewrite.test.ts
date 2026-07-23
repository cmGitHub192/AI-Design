import type http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { startServer } from '../src/server.js';

/**
 * The daemon's max_tokens→max_completion_tokens rewrite proxy for
 * OpenCode-driven Azure runs. OpenCode's openai-compatible provider always
 * sends max_tokens, which gpt-5-class Azure deployments reject; the daemon
 * points OpenCode at this route, which renames the param and forwards to the
 * real Azure endpoint carried on a header.
 */
describe('byok openai rewrite proxy', () => {
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

  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  function captureUpstream(status = 200) {
    const seen: { url: string; headers: Record<string, string>; body: any }[] = [];
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      seen.push({
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response('data: [DONE]\n\n', {
        status,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as unknown as typeof fetch;
    return seen;
  }

  async function post(headers: Record<string, string>, body: unknown) {
    return fetch(`${baseUrl}/internal/byok-openai/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('renames max_tokens to max_completion_tokens and forwards to the header target', async () => {
    const seen = captureUpstream();
    const res = await post(
      { 'api-key': 'sk-op', 'x-od-azure-base': 'https://inova.openai.azure.com/openai', 'x-od-azure-api-version': '2024-10-21' },
      { model: 'gpt-5.6-terra', max_tokens: 16384, messages: [{ role: 'user', content: 'hi' }] },
    );

    expect(res.status).toBe(200);
    const call = seen.at(0);
    if (!call) throw new Error('expected one upstream call');
    expect(call.url).toBe('https://inova.openai.azure.com/openai/deployments/gpt-5.6-terra/chat/completions?api-version=2024-10-21');
    expect(call.headers['api-key']).toBe('sk-op');
    expect(call.body.max_completion_tokens).toBe(16384);
    expect(call.body).not.toHaveProperty('max_tokens');
  });

  it('leaves an existing max_completion_tokens untouched', async () => {
    const seen = captureUpstream();
    await post(
      { 'api-key': 'sk-op', 'x-od-azure-base': 'https://inova.openai.azure.com/openai', 'x-od-azure-api-version': '2024-10-21' },
      { model: 'gpt-5.6-terra', max_completion_tokens: 4096, messages: [] },
    );
    expect(seen.at(0)?.body.max_completion_tokens).toBe(4096);
  });

  // Regression: Azure answers 400 "Function tools with reasoning_effort are not
  // supported for gpt-5.6-terra in /v1/chat/completions" when OpenCode sends
  // both on the same turn, which it does on every turn that has tools.
  it('drops reasoning_effort when the request carries function tools', async () => {
    const seen = captureUpstream();
    await post(
      { 'api-key': 'sk-op', 'x-od-azure-base': 'https://inova.openai.azure.com/openai', 'x-od-azure-api-version': '2024-10-21' },
      {
        model: 'gpt-5.6-terra',
        reasoning_effort: 'medium',
        verbosity: 'low',
        tools: [{ type: 'function', function: { name: 'read' } }],
        tool_choice: 'auto',
        messages: [{ role: 'user', content: 'hi' }],
      },
    );

    const body = seen.at(0)?.body;
    expect(body).not.toHaveProperty('reasoning_effort');
    // Only the rejected hint goes; everything the agent needs must survive.
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe('auto');
    expect(body.verbosity).toBe('low');
  });

  it('keeps reasoning_effort when no tools are present', async () => {
    const seen = captureUpstream();
    await post(
      { 'api-key': 'sk-op', 'x-od-azure-base': 'https://inova.openai.azure.com/openai', 'x-od-azure-api-version': '2024-10-21' },
      {
        model: 'gpt-5.6-terra',
        reasoning_effort: 'medium',
        messages: [{ role: 'user', content: 'hi' }],
      },
    );
    expect(seen.at(0)?.body.reasoning_effort).toBe('medium');
  });

  it('400s without the azure-base or api-key header', async () => {
    const res = await post({ 'api-key': 'sk-op' }, { model: 'x', messages: [] });
    expect(res.status).toBe(400);
  });

  it('rejects a non-public forward target (SSRF guard)', async () => {
    const res = await post(
      { 'api-key': 'sk-op', 'x-od-azure-base': 'http://169.254.169.254/openai', 'x-od-azure-api-version': '2024-10-21' },
      { model: 'x', messages: [] },
    );
    expect(res.status === 400 || res.status === 403).toBe(true);
  });
});
