import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

export interface Config {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  xaiApiKey?: string;
  groqApiKey?: string;
  timeoutMs: number;
  debug: boolean;
}

/**
 * Gets the value of an environment variable, returns undefined if not set
 */
function getEnvVar(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    return undefined;
  }
  return value;
}

/**
 * Returns a list of missing API keys
 */
export function getMissingApiKeys(): string[] {
  const apiKeys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'GROQ_API_KEY'];

  return apiKeys.filter((key) => {
    const value = process.env[key];
    return !value || value.trim() === '';
  });
}

/**
 * Loads configuration from environment variables
 * API keys are optional - missing keys will result in those providers being unavailable
 */
export function loadConfig(): Config {
  return {
    anthropicApiKey: getEnvVar('ANTHROPIC_API_KEY'),
    openaiApiKey: getEnvVar('OPENAI_API_KEY'),
    xaiApiKey: getEnvVar('XAI_API_KEY'),
    groqApiKey: getEnvVar('GROQ_API_KEY'),
    timeoutMs: parseInt(process.env.SECOND_BRAIN_TIMEOUT_MS || '30000', 10),
    debug: process.env.SECOND_BRAIN_DEBUG === 'true',
  };
}
