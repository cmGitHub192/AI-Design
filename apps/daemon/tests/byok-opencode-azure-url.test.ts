import { describe, expect, it } from 'vitest';

import { buildOpenCodeByokProviderConfig } from '../src/runtimes/byok-opencode.js';

/**
 * OpenCode drives Azure through @ai-sdk/azure, which appends
 * `/deployments/<name>/...` to the baseURL it is handed and does NOT insert
 * the `/openai` segment. A bare resource host therefore produced
 * `/deployments/...` — a 404 "Resource not found" — and the provider targets
 * the Responses API, which the old 2024-10-21 default does not serve.
 */
function azureOptions(baseUrl: string, apiVersion?: string) {
  const built = buildOpenCodeByokProviderConfig(
    { protocol: 'azure', apiKey: 'sk-test', baseUrl, ...(apiVersion ? { apiVersion } : {}) },
    'gpt-5.6-terra',
  );
  if (!built) throw new Error('expected a provider config');
  const entry = (built.config.provider as Record<string, { options: Record<string, unknown> }>)[
    built.providerId
  ];
  return entry.options;
}

describe('opencode azure provider url', () => {
  it('appends /openai to a bare resource host so the deployment path resolves', () => {
    const options = azureOptions('https://openai-inova-test.openai.azure.com');
    expect(options.baseURL).toBe('https://openai-inova-test.openai.azure.com/openai');
  });

  it('tolerates a trailing slash on the resource host', () => {
    const options = azureOptions('https://openai-inova-test.openai.azure.com/');
    expect(options.baseURL).toBe('https://openai-inova-test.openai.azure.com/openai');
  });

  it('defaults to a Responses-API-capable api-version', () => {
    const options = azureOptions('https://openai-inova-test.openai.azure.com');
    // 2024-10-21 predates /responses; the default must be new enough to serve it.
    expect(String(options.apiVersion)).toMatch(/^2025-/);
  });

  it('lets an operator-pinned api-version win', () => {
    const options = azureOptions('https://openai-inova-test.openai.azure.com', '2025-01-01-preview');
    expect(options.apiVersion).toBe('2025-01-01-preview');
  });

  it('leaves an already /openai-prefixed base url alone', () => {
    const options = azureOptions('https://openai-inova-test.openai.azure.com/openai');
    expect(options.baseURL).toBe('https://openai-inova-test.openai.azure.com/openai');
  });
});
