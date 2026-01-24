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
  geminiApiKey?: string;
  xaiApiKey?: string;
  groqApiKey?: string;
  timeoutMs: number;
  debug: boolean;
  brainModel: string;
}

export interface ModelConfig {
  name: string; // Display name (e.g., "GPT")
  provider: string; // Provider type (e.g., "openai")
  apiKey?: string; // From env
  models: string[]; // Array of model IDs to try (first = primary, rest = fallbacks)
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
  const apiKeys = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'XAI_API_KEY',
    'GROQ_API_KEY',
  ];

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
    geminiApiKey: getEnvVar('GEMINI_API_KEY'),
    xaiApiKey: getEnvVar('XAI_API_KEY'),
    groqApiKey: getEnvVar('GROQ_API_KEY'),
    timeoutMs: parseInt(process.env.SECOND_BRAIN_TIMEOUT_MS || '30000', 10),
    debug: process.env.SECOND_BRAIN_DEBUG === 'true',
    brainModel: getEnvVar('BRAIN_MODEL') || 'anthropic/claude-sonnet-4-5-20250929',
  };
}

// Load environment config
const env = loadConfig();

/**
 * Council model configurations
 * This is the single source of truth for all model configs.
 *
 * Models are tried in array order - first is primary, rest are fallbacks.
 * Users can edit this array to customize which models to use.
 */
export const COUNCIL_MODELS: ModelConfig[] = [
  {
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    apiKey: env.anthropicApiKey,
    models: [
      'claude-sonnet-4-5-20250929', // Primary: Latest Sonnet 4.5
      'claude-sonnet-3-5-20241022', // Fallback: Sonnet 3.5
    ],
  },
  {
    name: 'GPT',
    provider: 'openai',
    apiKey: env.openaiApiKey,
    models: [
      'gpt-5.2', // Primary: GPT-5.2 (requires org verification)
      'gpt-4o', // Fallback: GPT-4 Optimized (widely available)
      'gpt-4-turbo', // Fallback: GPT-4 Turbo
    ],
  },
  {
    name: 'Gemini',
    provider: 'gemini',
    apiKey: env.geminiApiKey,
    models: [
      'gemini-2.0-flash', // Primary: Fast Gemini
      'gemini-1.5-pro', // Fallback: Gemini 1.5 Pro
    ],
  },
  {
    name: 'Grok',
    provider: 'xai',
    apiKey: env.xaiApiKey,
    models: [
      'grok-3-beta', // Primary: Latest Grok
    ],
  },
  {
    name: 'Llama 4 Maverick',
    provider: 'groq',
    apiKey: env.groqApiKey,
    models: [
      'meta-llama/llama-4-maverick-17b-128e-instruct', // Primary: Llama 4 Maverick (128 experts)
      'llama-3.3-70b-versatile', // Fallback: Llama 3.3
    ],
  },
];

/**
 * Personal Brain model configuration
 * The Personal Brain orchestrates the entire flow:
 * - Pre-processes user queries before sending to Council
 * - Post-processes consensus results for final user presentation
 *
 * Default: Claude Sonnet 4.5 (best performing, cost not a concern for MVP)
 * Can be overridden via BRAIN_MODEL environment variable
 */
export const BRAIN_MODEL_CONFIG: ModelConfig = {
  name: 'Personal Brain',
  provider: 'anthropic',
  apiKey: env.anthropicApiKey,
  models: [
    'claude-sonnet-4-5-20250929', // Primary: Latest Sonnet 4.5
    'claude-sonnet-3-5-20241022', // Fallback: Sonnet 3.5
  ],
};
