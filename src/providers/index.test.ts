import { describe, expect, it } from 'vitest';
import { createCouncilProviders } from './index.js';

describe('Provider Factory', () => {
  it('should create council providers without errors', async () => {
    const providers = await createCouncilProviders();

    expect(Array.isArray(providers)).toBe(true);
    // We should have at least one provider (depends on which API keys are configured)
    // But we don't fail if no providers are available
  });

  it('should create providers with correct interface', async () => {
    const providers = await createCouncilProviders();

    providers.forEach((provider) => {
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
      expect(typeof provider.query).toBe('function');
      expect(typeof provider.queryStream).toBe('function');
    });
  });
});
