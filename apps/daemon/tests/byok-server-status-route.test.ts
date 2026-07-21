import type http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

/**
 * `GET /api/app-config` is how the browser learns it does not need to ask the
 * user for a key. Two properties matter, and they pull in opposite
 * directions: the endpoint must say *enough* for the UI to hide the field,
 * and *nothing* that would hand the operator's credential to the end user.
 */
describe('app-config server BYOK status', () => {
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
    delete process.env.OD_BYOK_PROTOCOL;
    delete process.env.OD_BYOK_API_KEY;
    delete process.env.OD_BYOK_BASE_URL;
    delete process.env.OD_BYOK_MODEL;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function readStatus() {
    const res = await fetch(`${baseUrl}/api/app-config`);
    expect(res.status).toBe(200);
    return (await res.json()) as {
      config: unknown;
      serverByok?: { configured: boolean; protocol?: string; model?: string };
    };
  }

  it('reports not-configured on a local-first install', async () => {
    const body = await readStatus();
    expect(body.serverByok).toEqual({ configured: false });
  });

  it('reports the provider identity when the operator configured one', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';
    process.env.OD_BYOK_MODEL = 'gpt-4o';

    const body = await readStatus();
    expect(body.serverByok).toEqual({
      configured: true,
      protocol: 'azure',
      model: 'gpt-4o',
    });
  });

  it('never exposes the operator key or resource URL', async () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';

    const res = await fetch(`${baseUrl}/api/app-config`);
    const raw = await res.text();
    expect(raw).not.toContain('sk-operator');
    expect(raw).not.toContain('inova.openai.azure.com');
  });

  it('stays unconfigured when a protocol is declared but no key resolves', async () => {
    // A half-configured deployment must keep asking the user for a key
    // rather than hide the field and fail at request time.
    process.env.OD_BYOK_PROTOCOL = 'azure';

    const body = await readStatus();
    expect(body.serverByok).toEqual({ configured: false });
  });

  it('cannot be forged through the prefs write path', async () => {
    // `serverByok` is a sibling of `config`, and PUT allowlists prefs keys,
    // so a client that posts it must not see it reflected back as truth.
    await fetch(`${baseUrl}/api/app-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serverByok: { configured: true, protocol: 'azure' } }),
    });

    const body = await readStatus();
    expect(body.serverByok).toEqual({ configured: false });
  });
});
