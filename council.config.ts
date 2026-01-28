import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = basename(__dirname) === 'dist' ? join(__dirname, '..') : __dirname;
dotenv.config({ path: join(projectRoot, '.env'), quiet: true });

export interface ModelConfig {
  name: string; // Display name (e.g., "GPT")
  provider: string; // Provider type (e.g., "openai")
  apiKey?: string; // From env
  models: string[]; // Array of model IDs to try (first = primary, rest = fallbacks)
}

function getEnvVar(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    return undefined;
  }
  return value;
}

/**
 * Council model configurations
 * This is the single source of truth for all model configs.
 *
 * Models are tried in array order - first is primary, rest are fallbacks.
 * Users can edit this array to customize which models to use.
 */
export const COUNCIL_MODELS: ModelConfig[] = [
  {
    name: 'Claude',
    provider: 'anthropic',
    apiKey: getEnvVar('ANTHROPIC_API_KEY'),
    models: [
      'claude-sonnet-4-5-20250929', // Primary: Latest Sonnet 4.5
      'claude-sonnet-3-5-20241022', // Fallback: Sonnet 3.5
    ],
  },
  {
    name: 'GPT',
    provider: 'openai',
    apiKey: getEnvVar('OPENAI_API_KEY'),
    models: [
      'gpt-5.2', // Primary: GPT-5.2 (requires org verification)
      'gpt-4o', // Fallback: GPT-4 Optimized (widely available)
      'gpt-4-turbo', // Fallback: GPT-4 Turbo
    ],
  },
  {
    name: 'Gemini',
    provider: 'gemini',
    apiKey: getEnvVar('GEMINI_API_KEY'),
    models: [
      'gemini-2.5-pro', // Primary: Best general Gemini
      'gemini-2.5-flash', // Fallback: Faster, lower cost
    ],
  },
  {
    name: 'Grok',
    provider: 'xai',
    apiKey: getEnvVar('XAI_API_KEY'),
    models: [
      'grok-3-beta', // Primary: Latest Grok
    ],
  },
  {
    name: 'Llama 4 Maverick',
    provider: 'groq',
    apiKey: getEnvVar('GROQ_API_KEY'),
    models: [
      'meta-llama/llama-4-maverick-17b-128e-instruct', // Primary: Llama 4 Maverick (128 experts)
      'llama-3.3-70b-versatile', // Fallback: Llama 3.3
    ],
  },
];
