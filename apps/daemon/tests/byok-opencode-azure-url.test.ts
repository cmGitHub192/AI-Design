import { describe, expect, it } from 'vitest';

import { buildOpenCodeByokProviderConfig } from '../src/runtimes/byok-opencode.js';

/**
 * OpenCode drives Azure through the OpenAI-compatible provider against the
 * resource's `/openai/v1` chat surface — NOT @ai-sdk/azure, whose default
 * Responses API target (`/deployments/<dep>/responses`) 404s on deployments
 * that only serve /chat/completions (verified against a live OpenCode binary
 * and the gpt-5.6-terra deployment). Auth rides in the `api-key` header, which
 * is what Azure expects; a bearer token from the apiKey option is rejected.
 */
function azureEntry(baseUrl: string) {
  const built = buildOpenCodeByokProviderConfig(
    { protocol: 'azure', apiKey: 'sk-test', baseUrl },
    'gpt-5.6-terra',
  );
  if (!built) throw new Error('expected a provider config');
  const entry = (built.config.provider as Record<string, { npm: string; options: Record<string, any> }>)[
    built.providerId
  ];
  if (!entry) throw new Error('expected a provider entry');
  return entry;
}

describe('opencode azure provider config', () => {
  it('uses the openai-compatible provider, not @ai-sdk/azure', () => {
    expect(azureEntry('https://inova.openai.azure.com').npm).toBe('@ai-sdk/openai-compatible');
  });

  it('points at the /openai/v1 chat surface for a bare resource host', () => {
    expect(azureEntry('https://inova.openai.azure.com').options.baseURL).toBe(
      'https://inova.openai.azure.com/openai/v1',
    );
  });

  it('tolerates a trailing slash on the resource host', () => {
    expect(azureEntry('https://inova.openai.azure.com/').options.baseURL).toBe(
      'https://inova.openai.azure.com/openai/v1',
    );
  });

  it('respects a base url already pointed at /openai/v1', () => {
    expect(azureEntry('https://inova.openai.azure.com/openai/v1').options.baseURL).toBe(
      'https://inova.openai.azure.com/openai/v1',
    );
  });

  it('sends the key in the api-key header, not as a bearer token', () => {
    const options = azureEntry('https://inova.openai.azure.com').options;
    expect(options.headers?.['api-key']).toBe('{env:OPEN_DESIGN_BYOK_API_KEY}');
    // A bearer apiKey option would be rejected by Azure — it must not be set.
    expect(options.apiKey).toBeUndefined();
  });
});
