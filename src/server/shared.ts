/**
 * Shared MCP Server Instance
 *
 * This module provides a shared McpServer instance and tool registration
 * that can be used by multiple transports (HTTP, stdio, SSE).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Council } from '../council/index.js';
import { Provider } from '../providers/types.js';
import { createCouncilProviders } from '../providers/index.js';
import { loadConfig } from '../config.js';
import { CouncilRequest, CouncilResponse, ModelCritique } from './types.js';
import { sanitizeCouncilRequest, sanitizeCouncilResponse } from './sanitize.js';

// Load configuration
const config = loadConfig();

// Council providers (initialized lazily)
let councilProviders: Provider[] = [];
let councilInitialized = false;

/**
 * Initialize Council providers
 */
export async function initializeCouncil(): Promise<void> {
  if (councilInitialized) {
    return;
  }

  try {
    councilProviders = await createCouncilProviders();
    councilInitialized = true;
    console.error(`✓ Council initialized with ${councilProviders.length} models`);
  } catch (error) {
    console.error('✗ Failed to initialize Council:', error);
    throw error;
  }
}

/**
 * Get Council providers (for health checks)
 */
export function getCouncilProviders(): Provider[] {
  return councilProviders;
}

/**
 * Check if Council is initialized
 */
export function isCouncilInitialized(): boolean {
  return councilInitialized;
}

// Zod schema for council_consult tool input
const CouncilConsultInputSchema = z
  .object({
    prompt: z
      .string()
      .min(1, 'Prompt is required')
      .describe('The question or prompt to consult the Council about'),
    context: z
      .string()
      .optional()
      .describe('Optional additional context to help the Council understand the question'),
  })
  .strict();

type CouncilConsultInput = z.infer<typeof CouncilConsultInputSchema>;

/**
 * Core Council consultation logic (shared between all transports)
 */
export async function consultCouncil(request: CouncilRequest): Promise<CouncilResponse> {
  if (!councilInitialized || councilProviders.length === 0) {
    throw new Error('Council not initialized. Please wait for server startup.');
  }

  // Sanitize inputs and detect injection attempts
  const sanitized = sanitizeCouncilRequest(request.prompt, request.context);

  if (sanitized.injectionDetected) {
    console.warn('⚠️ Proceeding with potentially malicious prompt (injection detected)');
  }

  // Build the full prompt with context if provided
  const fullPrompt = sanitized.context
    ? `Context: ${sanitized.context}\n\nQuestion: ${sanitized.prompt}`
    : sanitized.prompt;

  // Create Council instance and deliberate
  const council = new Council(councilProviders, {
    timeoutMs: config.timeoutMs,
  });

  const result = await council.deliberate(fullPrompt);

  // Transform deliberation result to response format with output sanitization
  const critiques: ModelCritique[] = result.responses.map((response) => {
    const content = response.error || response.content;
    const sanitizedOutput = sanitizeCouncilResponse(content);

    return {
      model: response.provider,
      response: sanitizedOutput.text,
      latency_ms: response.latencyMs,
      ...(response.error ? { error: response.error } : {}),
      ...(sanitizedOutput.redacted ? { redacted: true, warnings: sanitizedOutput.warnings } : {}),
    };
  });

  return {
    critiques,
    summary: {
      models_consulted: councilProviders.length,
      models_responded: result.successCount,
      models_failed: result.failureCount,
      total_latency_ms: result.totalLatencyMs,
    },
  };
}

// Create shared MCP server instance
export const mcpServer = new McpServer({
  name: 'council-mcp-server',
  version: '1.0.0',
});

/**
 * Register all MCP tools on the shared server instance
 */
export function registerMcpTools(): void {
  mcpServer.registerTool(
    'council_consult',
    {
      title: 'Consult Council',
      description: `Consult the Council of 4 frontier AI models for alternative perspectives, critiques, and suggestions.

This tool is designed for "Phone a Friend" scenarios - when you're uncertain or stuck, the Council provides independent critiques from multiple models to help you make better decisions.

The Council consists of:
- Claude Sonnet 4.5 (Anthropic)
- GPT-5.2 / GPT-4o (OpenAI)
- Grok 3 Beta (xAI)
- Llama 4 Maverick (Groq)

All models are queried in parallel and provide independent responses without knowing what other models said.

Args:
  - prompt (string): The question or problem you need help with
  - context (string, optional): Additional context to help models understand the situation

Returns:
  JSON object with schema:
  {
    "critiques": [
      {
        "model": string,        // Model name
        "response": string,     // Model's critique/suggestion
        "latency_ms": number,   // Response time
        "error": string         // Present only if model failed
      }
    ],
    "summary": {
      "models_consulted": number,
      "models_responded": number,
      "models_failed": number,
      "total_latency_ms": number
    }
  }

Examples:
  - Use when: You're stuck debugging a complex issue -> consult Council for alternative approaches
  - Use when: You need to make an architectural decision -> get multiple perspectives
  - Use when: You're uncertain about code correctness -> get critiques from different models

Error Handling:
  - Individual model failures are captured in the "error" field
  - The Council continues even if some models fail (partial results returned)
  - Returns error if Council is not initialized`,
      inputSchema: CouncilConsultInputSchema,
      annotations: {
        readOnlyHint: false, // Council queries external models
        destructiveHint: false, // No destructive operations
        idempotentHint: false, // Different responses each time
        openWorldHint: true, // Interacts with external AI services
      },
    },
    async (params: CouncilConsultInput) => {
      try {
        const result = await consultCouncil({
          prompt: params.prompt,
          context: params.context,
        });

        // Format as both text (markdown) and structured data
        const lines = [
          '# Council Consultation Results',
          '',
          `**Models Responded:** ${result.summary.models_responded}/${result.summary.models_consulted}`,
          `**Total Time:** ${(result.summary.total_latency_ms / 1000).toFixed(1)}s`,
          '',
        ];

        for (const critique of result.critiques) {
          if (critique.error) {
            lines.push(`## ${critique.model} ✗`);
            lines.push(`**Error:** ${critique.error}`);
          } else {
            lines.push(`## ${critique.model} ✓`);
            lines.push(critique.response);
          }
          lines.push('');
        }

        const textContent = lines.join('\n');

        return {
          content: [{ type: 'text', text: textContent }],
          structuredContent: result as unknown as Record<string, unknown>, // Modern pattern for structured data
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error consulting Council: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
}

// Register tools on module load
registerMcpTools();
