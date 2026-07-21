import { afterEach, describe, expect, it } from 'vitest';

import {
  applyServerByokDefaults,
  resolveServerByokDefaults,
  serverByokApiKey,
} from '../src/byok-server-defaults.js';
import { buildOpenCodeByokProviderConfig } from '../src/runtimes/byok-opencode.js';

const MANAGED_ENV_KEYS = [
  'OD_BYOK_PROTOCOL',
  'OD_BYOK_API_KEY',
  'OD_BYOK_BASE_URL',
  'OD_BYOK_API_VERSION',
  'OD_BYOK_MODEL',
  'AZURE_OPENAI_API_KEY',
  'AZURE_API_KEY',
] as const;

function envWith(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of MANAGED_ENV_KEYS) delete env[key];
  return { ...env, ...overrides };
}

describe('server-side BYOK defaults', () => {
  afterEach(() => {
    for (const key of MANAGED_ENV_KEYS) delete process.env[key];
  });

  it('stays inert when the operator configured nothing', () => {
    expect(resolveServerByokDefaults(envWith({}))).toBeNull();
    expect(serverByokApiKey('azure', envWith({}))).toBe('');
  });

  it('activates only when a protocol is declared', () => {
    // A stray AZURE_OPENAI_API_KEY in the environment (very common on Azure
    // hosts) must not silently turn a local-first install into a hosted one.
    const env = envWith({ AZURE_OPENAI_API_KEY: 'sk-stray' });
    expect(resolveServerByokDefaults(env)).toBeNull();
  });

  it('resolves a full Azure provider config from the environment', () => {
    const defaults = resolveServerByokDefaults(
      envWith({
        OD_BYOK_PROTOCOL: 'azure',
        OD_BYOK_API_KEY: 'sk-operator',
        OD_BYOK_BASE_URL: 'https://inova.openai.azure.com',
        OD_BYOK_API_VERSION: '2024-10-21',
        OD_BYOK_MODEL: 'gpt-4o',
      }),
    );
    expect(defaults).toEqual({
      protocol: 'azure',
      apiKey: 'sk-operator',
      baseUrl: 'https://inova.openai.azure.com',
      apiVersion: '2024-10-21',
      model: 'gpt-4o',
    });
  });

  it('falls back to the canonical Azure key envs when OD_BYOK_API_KEY is absent', () => {
    expect(
      serverByokApiKey('azure', envWith({ AZURE_OPENAI_API_KEY: 'sk-canonical' })),
    ).toBe('sk-canonical');
    expect(serverByokApiKey('azure', envWith({ AZURE_API_KEY: 'sk-alt' }))).toBe('sk-alt');
    // OD_BYOK_API_KEY is the project-reserved override and wins.
    expect(
      serverByokApiKey(
        'azure',
        envWith({ OD_BYOK_API_KEY: 'sk-override', AZURE_OPENAI_API_KEY: 'sk-canonical' }),
      ),
    ).toBe('sk-override');
  });

  it('rejects a protocol the contract does not model', () => {
    expect(resolveServerByokDefaults(envWith({ OD_BYOK_PROTOCOL: 'bedrock' }))).toBeNull();
  });

  it('fills a request that carries no credential at all', () => {
    const env = envWith({
      OD_BYOK_PROTOCOL: 'azure',
      OD_BYOK_API_KEY: 'sk-operator',
      OD_BYOK_BASE_URL: 'https://inova.openai.azure.com',
      OD_BYOK_MODEL: 'gpt-4o',
    });
    expect(applyServerByokDefaults(null, env)).toEqual({
      protocol: 'azure',
      apiKey: 'sk-operator',
      baseUrl: 'https://inova.openai.azure.com',
      model: 'gpt-4o',
    });
  });

  it('lets an explicit request field win over the environment', () => {
    const env = envWith({
      OD_BYOK_PROTOCOL: 'azure',
      OD_BYOK_API_KEY: 'sk-operator',
      OD_BYOK_BASE_URL: 'https://inova.openai.azure.com',
    });
    const filled = applyServerByokDefaults(
      { protocol: 'azure', apiKey: 'sk-user-own', baseUrl: '' },
      env,
    );
    expect(filled?.apiKey).toBe('sk-user-own');
    expect(filled?.baseUrl).toBe('https://inova.openai.azure.com');
  });

  it('does not cross-fill a credential from a different protocol', () => {
    // Operator configured Azure; a request that explicitly asks for anthropic
    // must not receive the Azure key.
    const env = envWith({
      OD_BYOK_PROTOCOL: 'azure',
      OD_BYOK_API_KEY: 'sk-operator',
      OD_BYOK_BASE_URL: 'https://inova.openai.azure.com',
    });
    const filled = applyServerByokDefaults({ protocol: 'anthropic', apiKey: '' }, env);
    expect(filled?.apiKey).toBe('');
    expect(filled?.baseUrl).toBeFalsy();
  });

  it('lets the agent run path build a usable config with no client credential', () => {
    process.env.OD_BYOK_PROTOCOL = 'azure';
    process.env.OD_BYOK_API_KEY = 'sk-operator';
    process.env.OD_BYOK_BASE_URL = 'https://inova.openai.azure.com';

    const built = buildOpenCodeByokProviderConfig({ protocol: 'azure' }, 'gpt-4o');
    expect(built).not.toBeNull();
    expect(built?.env.OPEN_DESIGN_BYOK_API_KEY).toBe('sk-operator');
    expect(built?.modelId).toBe('open-design-byok/gpt-4o');
  });

  it('still fails the agent run when neither client nor server has a key', () => {
    expect(buildOpenCodeByokProviderConfig({ protocol: 'azure' }, 'gpt-4o')).toBeNull();
  });
});
