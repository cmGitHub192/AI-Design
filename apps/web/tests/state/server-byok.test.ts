import { afterEach, describe, expect, it } from 'vitest';
import {
  __setServerByokStatusForTest,
  adoptServerByokStatus,
  serverByokCoversProtocol,
  serverByokSnapshot,
} from '../../src/state/serverByok';
import { byokProviderRequiresApiKey } from '../../src/utils/byokProvider';

/**
 * The hosted deployment must stop asking the user for a key it will never
 * need — without loosening the local-first install, where the key is still
 * the user's to supply.
 */
describe('server-supplied BYOK status', () => {
  afterEach(() => {
    __setServerByokStatusForTest({ configured: false });
  });

  describe('adopting the app-config payload', () => {
    it('defaults to not-configured on an older daemon that omits the field', () => {
      adoptServerByokStatus({ config: {} });
      expect(serverByokSnapshot()).toEqual({ configured: false });
    });

    it('adopts a configured provider', () => {
      adoptServerByokStatus({
        config: {},
        serverByok: { configured: true, protocol: 'azure', model: 'gpt-4o' },
      });
      expect(serverByokSnapshot()).toEqual({
        configured: true,
        protocol: 'azure',
        model: 'gpt-4o',
      });
    });

    it('ignores a configured flag with no protocol', () => {
      // Without a protocol there is nothing to scope the credential to, so
      // trusting it would let any request claim to be covered.
      adoptServerByokStatus({ serverByok: { configured: true } });
      expect(serverByokSnapshot()).toEqual({ configured: false });
    });

    it('survives a malformed body', () => {
      adoptServerByokStatus(null);
      adoptServerByokStatus({ serverByok: 'yes' });
      expect(serverByokSnapshot()).toEqual({ configured: false });
    });
  });

  describe('protocol scoping', () => {
    it('covers only the protocol the operator declared', () => {
      __setServerByokStatusForTest({ configured: true, protocol: 'azure' });
      expect(serverByokCoversProtocol('azure')).toBe(true);
      expect(serverByokCoversProtocol('anthropic')).toBe(false);
    });
  });

  describe('key requirement', () => {
    it('still demands a key on a local-first install', () => {
      expect(byokProviderRequiresApiKey('azure', undefined, '')).toBe(true);
    });

    it('drops the requirement for the operator-configured protocol', () => {
      __setServerByokStatusForTest({ configured: true, protocol: 'azure' });
      expect(byokProviderRequiresApiKey('azure', undefined, '')).toBe(false);
    });

    it('keeps demanding a key for every other protocol', () => {
      // An Azure-configured daemon must not make an Anthropic request look
      // credential-free; that request would reach the proxy with no key.
      __setServerByokStatusForTest({ configured: true, protocol: 'azure' });
      expect(byokProviderRequiresApiKey('anthropic', undefined, '')).toBe(true);
    });

    it('leaves the existing opt-outs intact', () => {
      expect(
        byokProviderRequiresApiKey('ollama', undefined, 'http://localhost:11434'),
      ).toBe(false);
    });
  });
});
