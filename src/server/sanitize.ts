/**
 * Input/Output Sanitization
 *
 * Provides functions to sanitize user inputs and outputs to protect against
 * injection attacks, data leakage, and other security vulnerabilities.
 */

// Maximum lengths for inputs (prevent memory exhaustion)
const MAX_PROMPT_LENGTH = 10000;
const MAX_CONTEXT_LENGTH = 5000;

/**
 * Sanitize text input by removing control characters and enforcing length limits
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized text
 */
export function sanitizeInput(text: string, maxLength: number = MAX_PROMPT_LENGTH): string {
  if (!text) {
    return '';
  }

  return (
    text
      // Remove control characters (except newlines and tabs)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove null bytes
      .replace(/\0/g, '')
      .trim()
      // Enforce length limit
      .slice(0, maxLength)
  );
}

/**
 * Detect potential prompt injection attempts
 *
 * @param text - The text to check for injection patterns
 * @returns true if suspicious patterns are detected
 */
export function detectInjection(text: string): boolean {
  if (!text) {
    return false;
  }

  // Common prompt injection patterns
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /system\s*:\s*/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|system\|>/i,
    /<\|assistant\|>/i,
    /<\|user\|>/i,
    /you\s+are\s+now/i,
    /new\s+instructions/i,
    /override\s+instructions/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize and validate Council request inputs
 *
 * @param prompt - The user's prompt
 * @param context - Optional context
 * @returns Sanitized inputs with injection detection flag
 */
export function sanitizeCouncilRequest(
  prompt: string,
  context?: string
): {
  prompt: string;
  context?: string;
  injectionDetected: boolean;
} {
  const sanitizedPrompt = sanitizeInput(prompt, MAX_PROMPT_LENGTH);
  const sanitizedContext = context ? sanitizeInput(context, MAX_CONTEXT_LENGTH) : undefined;

  // Check for injection attempts in both prompt and context
  const injectionDetected =
    detectInjection(sanitizedPrompt) ||
    (sanitizedContext ? detectInjection(sanitizedContext) : false);

  if (injectionDetected) {
    console.warn('⚠️ Potential prompt injection detected in request');
  }

  return {
    prompt: sanitizedPrompt,
    context: sanitizedContext,
    injectionDetected,
  };
}

/**
 * Get fresh regex patterns for detecting sensitive data
 * (Patterns are recreated on each call to avoid global flag reuse issues)
 */
function getSensitivePatterns() {
  return {
    // API keys and tokens
    apiKeys: [
      /sk-ant-[a-zA-Z0-9]{20,}/g, // Anthropic API keys
      /sk-[a-zA-Z0-9]{32,}/g, // OpenAI API keys
      /AIza[0-9A-Za-z-_]{30,}/g, // Gemini API keys (Google)
      /xai-[a-zA-Z0-9]{20,}/g, // xAI API keys
      /gsk_[a-zA-Z0-9]{20,}/g, // Groq API keys
      /Bearer\s+[a-zA-Z0-9._-]{20,}/g, // Bearer tokens
    ],
    // AWS credentials
    aws: [
      /AKIA[0-9A-Z]{16}/g, // AWS access key IDs
      /aws_secret_access_key\s*=\s*[a-zA-Z0-9/+=]{40}/g,
    ],
    // Private keys
    privateKeys: [
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
      /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,
    ],
    // Email addresses
    emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  };
}

/**
 * Detect sensitive data in output text
 *
 * @param text - The text to check for sensitive data
 * @returns Object with detection flags for different types of sensitive data
 */
export function detectSensitiveData(text: string): {
  hasApiKeys: boolean;
  hasAwsCredentials: boolean;
  hasPrivateKeys: boolean;
  hasEmails: boolean;
} {
  if (!text) {
    return {
      hasApiKeys: false,
      hasAwsCredentials: false,
      hasPrivateKeys: false,
      hasEmails: false,
    };
  }

  const patterns = getSensitivePatterns();

  return {
    hasApiKeys: patterns.apiKeys.some((pattern) => pattern.test(text)),
    hasAwsCredentials: patterns.aws.some((pattern) => pattern.test(text)),
    hasPrivateKeys: patterns.privateKeys.some((pattern) => pattern.test(text)),
    hasEmails: patterns.emails.test(text),
  };
}

/**
 * Redact sensitive data from output text
 *
 * @param text - The text to redact sensitive data from
 * @returns Redacted text with sensitive patterns replaced
 */
export function redactSensitiveData(text: string): string {
  if (!text) {
    return '';
  }

  let redacted = text;
  const patterns = getSensitivePatterns();

  // Redact API keys
  patterns.apiKeys.forEach((pattern) => {
    redacted = redacted.replace(pattern, '[REDACTED_API_KEY]');
  });

  // Redact AWS credentials
  patterns.aws.forEach((pattern) => {
    redacted = redacted.replace(pattern, '[REDACTED_AWS_CREDENTIAL]');
  });

  // Redact private keys
  patterns.privateKeys.forEach((pattern) => {
    redacted = redacted.replace(pattern, '[REDACTED_PRIVATE_KEY]');
  });

  return redacted;
}

/**
 * Sanitize Council response output
 *
 * @param text - The response text to sanitize
 * @returns Sanitized text with sensitive data redacted and detection warnings
 */
export function sanitizeCouncilResponse(text: string): {
  text: string;
  redacted: boolean;
  warnings: string[];
} {
  if (!text) {
    return { text: '', redacted: false, warnings: [] };
  }

  const detection = detectSensitiveData(text);
  const warnings: string[] = [];
  let redacted = false;

  if (detection.hasApiKeys) {
    warnings.push('API keys detected and redacted');
    redacted = true;
  }

  if (detection.hasAwsCredentials) {
    warnings.push('AWS credentials detected and redacted');
    redacted = true;
  }

  if (detection.hasPrivateKeys) {
    warnings.push('Private keys detected and redacted');
    redacted = true;
  }

  if (detection.hasEmails) {
    warnings.push('Email addresses detected (not redacted)');
    // Note: We detect but don't redact emails as they may be legitimate content
  }

  if (redacted) {
    console.warn('⚠️ Sensitive data redacted from Council response:', warnings.join(', '));
    return {
      text: redactSensitiveData(text),
      redacted: true,
      warnings,
    };
  }

  // Return warnings even if nothing was redacted (e.g., email detection)
  return { text, redacted: false, warnings };
}
