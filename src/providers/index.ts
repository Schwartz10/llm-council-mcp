import { COUNCIL_MODELS } from '../config.js';
import { AnthropicProvider } from './anthropic/index.js';
import { GroqProvider } from './groq/index.js';
import { OpenAIProvider } from './openai/index.js';
import { Provider } from './types.js';
import { XAIProvider } from './xai/index.js';

// Re-export types
export type { Provider, ProviderResponse } from './types.js';

/**
 * Creates a provider instance for a given model config
 * Returns the provider or null if API key is missing
 */
function createProvider(
  providerType: string,
  apiKey: string,
  modelId: string,
  displayName: string
): Provider {
  switch (providerType) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, modelId, displayName);
    case 'openai':
      return new OpenAIProvider(apiKey, modelId, displayName);
    case 'xai':
      return new XAIProvider(apiKey, modelId, displayName);
    case 'groq':
      return new GroqProvider(apiKey, modelId, displayName);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

/**
 * Creates providers for all configured council models
 * Skips models with missing API keys
 * Uses the PRIMARY model from each config (first in the models array)
 *
 * Note: Fallback logic (trying secondary models if primary fails) will be
 * implemented at the Council level, not here.
 */
export function createCouncilProviders(): Provider[] {
  const providers: Provider[] = [];

  for (const config of COUNCIL_MODELS) {
    // Skip if no API key
    if (!config.apiKey) {
      console.warn(`⚠️  Skipping ${config.name}: No API key configured`);
      continue;
    }

    // Skip if no models configured
    if (!config.models || config.models.length === 0) {
      console.warn(`⚠️  Skipping ${config.name}: No models configured`);
      continue;
    }

    // Use the primary model (first in the array)
    const primaryModel = config.models[0];

    try {
      const provider = createProvider(config.provider, config.apiKey, primaryModel, config.name);
      providers.push(provider);
    } catch (error) {
      console.error(
        `❌ Failed to create provider for ${config.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return providers;
}

/**
 * Creates a single provider with fallback support
 * Tries each model in the config's models array until one succeeds
 *
 * @param config - Model configuration from COUNCIL_MODELS
 * @param testPrompt - Optional test prompt to verify the provider works
 * @returns Provider instance or null if all models fail
 */
export async function createProviderWithFallback(
  config: (typeof COUNCIL_MODELS)[number],
  testPrompt: string = 'Hello'
): Promise<Provider | null> {
  if (!config.apiKey) {
    return null;
  }

  for (const modelId of config.models) {
    try {
      const provider = createProvider(config.provider, config.apiKey, modelId, config.name);

      // Test the provider with a simple query
      await provider.query(testPrompt);

      return provider;
    } catch {
      // Try next model in the fallback chain
      continue;
    }
  }

  // All models failed
  return null;
}
