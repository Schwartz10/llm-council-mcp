import { loadConfig } from '../config.js';

/**
 * Test configuration using cheaper/faster models
 * This minimizes token usage and cost during testing
 */
export const TEST_MODELS = {
  anthropic: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 (verified working in Phase 1)
  openai: 'gpt-4o-mini', // Mini is cheapest
  xai: 'grok-3-beta', // Only one model available
  groq: 'llama-3.3-70b-versatile', // Fast and cheap via Groq
};

/**
 * Simple test prompt that requires minimal tokens
 */
export const TEST_PROMPT = 'Say "OK" if you can hear me.';

/**
 * Gets API keys from environment
 */
export function getTestApiKeys() {
  const config = loadConfig();
  return {
    anthropic: config.anthropicApiKey,
    openai: config.openaiApiKey,
    xai: config.xaiApiKey,
    groq: config.groqApiKey,
  };
}

/**
 * Helper to skip tests if API key is missing
 */
export function skipIfNoApiKey(apiKey: string | undefined, providerName: string) {
  if (!apiKey) {
    console.warn(`⚠️  Skipping ${providerName} tests: No API key configured`);
    return true;
  }
  return false;
}
