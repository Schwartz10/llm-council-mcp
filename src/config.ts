import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true });

export interface Config {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  xaiApiKey?: string;
  groqApiKey?: string;
  debug: boolean;
  redactEmails: boolean;
  attachmentMaxBytes: number;
  attachmentMaxTotalBytes: number;
  attachmentMaxCount: number;
  attachmentAllowedMediaTypes: string[];
  attachmentAllowUrls: boolean;
  fallbackCooldownMs: number;
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

function getEnvInt(name: string, fallback: number): number {
  const value = getEnvVar(name);
  if (!value) {
    return fallback;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const DEFAULT_ATTACHMENT_MEDIA_TYPES = [
  'text/*',
  'application/json',
  'application/pdf',
  'application/zip',
  'image/*',
];

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
  const mediaTypesRaw = getEnvVar('LLM_COUNCIL_ATTACHMENT_ALLOWED_MEDIA_TYPES');
  const attachmentAllowedMediaTypes =
    mediaTypesRaw
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? DEFAULT_ATTACHMENT_MEDIA_TYPES;

  return {
    anthropicApiKey: getEnvVar('ANTHROPIC_API_KEY'),
    openaiApiKey: getEnvVar('OPENAI_API_KEY'),
    geminiApiKey: getEnvVar('GEMINI_API_KEY'),
    xaiApiKey: getEnvVar('XAI_API_KEY'),
    groqApiKey: getEnvVar('GROQ_API_KEY'),
    debug: process.env.LLM_COUNCIL_DEBUG === 'true',
    redactEmails: process.env.LLM_COUNCIL_REDACT_EMAILS !== 'false',
    attachmentMaxBytes: getEnvInt('LLM_COUNCIL_ATTACHMENT_MAX_BYTES', 5_000_000),
    attachmentMaxTotalBytes: getEnvInt('LLM_COUNCIL_ATTACHMENT_MAX_TOTAL_BYTES', 20_000_000),
    attachmentMaxCount: getEnvInt('LLM_COUNCIL_ATTACHMENT_MAX_COUNT', 5),
    attachmentAllowedMediaTypes,
    attachmentAllowUrls: process.env.LLM_COUNCIL_ATTACHMENT_ALLOW_URLS === 'true',
    fallbackCooldownMs: getEnvInt('LLM_COUNCIL_FALLBACK_COOLDOWN_MS', 120000),
  };
}
