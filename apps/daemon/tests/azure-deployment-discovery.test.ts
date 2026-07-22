import { afterEach, describe, expect, it, vi } from 'vitest';

import { listProviderModels } from '../src/integrations/provider-models.js';

/**
 * Azure routes inference by deployment name, so the picker has to list the
 * resource's deployments rather than a hardcoded model catalogue. Before this
 * existed the daemon answered `unsupported_protocol` and the UI could only
 * offer whatever was pinned in the client's static list.
 */
describe('azure deployment discovery', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  function stubAzure(body: unknown, status = 200) {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      seen.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return seen;
  }

  it('lists deployments from the resource, authenticating with api-key', async () => {
    const seen = stubAzure({
      data: [
        { id: 'gpt-5-terra-prod', model: 'gpt-5.6-terra', status: 'succeeded' },
        { id: 'gpt-4o', model: 'gpt-4o', status: 'succeeded' },
      ],
    });

    const result = await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.models) throw new Error('expected models');
    expect(result.models.map((m) => m.id)).toEqual(['gpt-5-terra-prod', 'gpt-4o']);

    const call = seen.at(0);
    if (!call) throw new Error('expected one upstream call');
    expect(call.url).toContain('/openai/deployments');
    expect(call.url).toContain('api-version=');
    // Azure rejects bearer tokens on the data plane.
    expect(call.headers['api-key']).toBe('sk-operator');
    expect(call.headers.authorization).toBeUndefined();
  });

  it('labels a deployment with its backing model when the names differ', async () => {
    stubAzure({
      data: [
        { id: 'prod-chat', model: 'gpt-5.6-terra', status: 'succeeded' },
        { id: 'gpt-4o', model: 'gpt-4o', status: 'succeeded' },
      ],
    });

    const result = await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    if (!result.ok || !result.models) throw new Error('expected models');
    // An opaque deployment name is useless in a picker without its model.
    expect(result.models[0]).toMatchObject({ id: 'prod-chat', label: 'prod-chat (gpt-5.6-terra)' });
    // ...but repeating the name when they match is just noise.
    expect(result.models[1]).toMatchObject({ id: 'gpt-4o', label: 'gpt-4o' });
  });

  it('hides deployments that are not ready to serve', async () => {
    stubAzure({
      data: [
        { id: 'ready', model: 'gpt-4o', status: 'succeeded' },
        { id: 'still-creating', model: 'gpt-4o', status: 'creating' },
        { id: 'broken', model: 'gpt-4o', status: 'failed' },
      ],
    });

    const result = await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    // Offering one of these would 404 at send time with no explanation.
    if (!result.ok || !result.models) throw new Error('expected models');
    expect(result.models.map((m) => m.id)).toEqual(['ready']);
  });

  it('defaults to the preview api-version, the only one that lists deployments', async () => {
    // Verified against a live resource: 2023-05-15, 2024-06-01, and
    // 2024-10-21 all answer 404 "Resource not found" for
    // GET /openai/deployments; only the preview surface returns the list.
    // Aligning this with the chat api-version would break discovery again.
    const seen = stubAzure({ data: [{ id: 'gpt-4o', model: 'gpt-4o', status: 'succeeded' }] });

    await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    expect(seen.at(0)?.url).toContain('api-version=2023-03-15-preview');
  });

  it('honors an operator-pinned api-version', async () => {
    const seen = stubAzure({ data: [{ id: 'gpt-4o', model: 'gpt-4o', status: 'succeeded' }] });

    await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
      apiVersion: '2024-10-21',
    });

    expect(seen.at(0)?.url).toContain('api-version=2024-10-21');
  });

  it('reports an empty resource as no_models rather than success', async () => {
    stubAzure({ data: [] });

    const result = await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.kind).toBe('no_models');
  });

  it('never echoes the key back in an error detail', async () => {
    stubAzure({ error: { message: 'Access denied for key sk-operator' } }, 401);

    const result = await listProviderModels({
      protocol: 'azure',
      baseUrl: 'https://inova.openai.azure.com',
      apiKey: 'sk-operator',
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('sk-operator');
  });
});
