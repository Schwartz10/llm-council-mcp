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
import { normalizeAttachments } from './attachments.js';
import { sanitizeCouncilRequest, sanitizeCouncilResponse } from './sanitize.js';
import { toMcpError } from './mcp-errors.js';
import { extractSynthesisData } from './synthesis.js';

// Load configuration
const config = loadConfig();

// Council providers (initialized lazily)
let councilProviders: Provider[] = [];
let councilInitialized = false;

/**
 * Initialize Council providers
 */
export function initializeCouncil(): void {
  if (councilInitialized) {
    return;
  }

  try {
    councilProviders = createCouncilProviders();
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

// Zod schema for phone_council tool input
const PhoneCouncilInputSchema = z
  .object({
    prompt: z
      .string()
      .min(1, 'Prompt is required')
      .describe('The question or prompt to consult the Council about'),
    context: z
      .string()
      .optional()
      .describe('Optional additional context to help the Council understand the question'),
    attachments: z
      .array(
        z
          .object({
            filename: z.string().optional().describe('Optional filename for the attachment'),
            mediaType: z.string().min(1).describe('IANA media type (e.g., application/zip)'),
            data: z
              .string()
              .optional()
              .describe('Base64-encoded content or data URL for the attachment'),
            url: z.string().url().optional().describe('http(s) URL to the attachment'),
          })
          .refine((value) => (value.data ? !value.url : !!value.url), {
            message: 'Provide exactly one of data or url for attachments',
          })
      )
      .optional()
      .describe('Optional file attachments to include with the consultation'),
    show_raw: z
      .boolean()
      .optional()
      .describe('If true, skip synthesis data and return only raw model responses'),
  })
  .strict();

type PhoneCouncilInput = z.infer<typeof PhoneCouncilInputSchema>;

const SYNTHESIS_INSTRUCTION =
  'Read the council responses and structured synthesis_data. Use it to: (1) identify areas of consensus, (2) highlight disagreements, (3) extract key insights and attribute them, (4) form your updated position, (5) explain what changed your mind. Present a synthesized answer that shows you learned from the council.';

/**
 * Core Council consultation logic (shared between all transports)
 */
export async function consultCouncilWithProviders(
  request: CouncilRequest,
  providers: Provider[]
): Promise<CouncilResponse> {
  if (providers.length === 0) {
    throw new Error('No Council providers available.');
  }

  // Sanitize inputs and detect injection attempts
  const sanitized = sanitizeCouncilRequest(request.prompt, request.context);

  if (sanitized.injectionDetected) {
    console.warn('⚠️ Proceeding with potentially malicious prompt (injection detected)');
  }

  const attachments = normalizeAttachments(request.attachments);

  // Build the full prompt with context if provided
  const fullPrompt = sanitized.context
    ? `Context: ${sanitized.context}\n\nQuestion: ${sanitized.prompt}`
    : sanitized.prompt;

  // Create Council instance and deliberate (no automatic timeout, only user cancellation via signal)
  const council = new Council(providers, {
    debug: config.debug,
  });

  const result = await council.deliberate(fullPrompt, {
    attachments,
    signal: request.signal,
  });

  const showRaw = request.show_raw === true;

  // Transform deliberation result to response format with output sanitization
  const critiques: ModelCritique[] = result.responses.map((response) => {
    const content = response.error || response.content;
    const sanitizedOutput = sanitizeCouncilResponse(content, { redactEmails: config.redactEmails });

    return {
      model: response.provider,
      model_id: response.modelId,
      response: sanitizedOutput.text,
      latency_ms: response.latencyMs,
      ...(response.error ? { error: response.error } : {}),
      ...(sanitizedOutput.redacted ? { redacted: true, warnings: sanitizedOutput.warnings } : {}),
    };
  });

  const baseResponse: CouncilResponse = {
    critiques,
    summary: {
      models_consulted: providers.length,
      models_responded: result.successCount,
      models_failed: result.failureCount,
      total_latency_ms: result.totalLatencyMs,
    },
  };

  if (showRaw) {
    return baseResponse;
  }

  const synthesis_data = extractSynthesisData(critiques);
  return {
    ...baseResponse,
    synthesis_data,
    synthesis_instruction: SYNTHESIS_INSTRUCTION,
  };
}

export async function consultCouncil(request: CouncilRequest): Promise<CouncilResponse> {
  if (!councilInitialized || councilProviders.length === 0) {
    throw new Error('Council not initialized. Please wait for server startup.');
  }

  return consultCouncilWithProviders(request, councilProviders);
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
  const registerCouncilTool = (toolName: 'phone_council' | 'council_consult', deprecated = false) =>
    mcpServer.registerTool(
      toolName,
      {
        title: deprecated ? 'Consult Council (Deprecated)' : 'Phone Council',
        description: `Consult the Council of frontier AI models for alternative perspectives, critiques, and suggestions.

This tool is designed for "Phone a Friend" scenarios - when you're uncertain or stuck, the Council provides independent critiques from multiple models to help you make better decisions.

The Council consists of:
- Claude Sonnet 4.5 (Anthropic)
- GPT-5.2 / GPT-4o (OpenAI)
- Gemini (Google)
- Grok 3 Beta (xAI)
- Llama 4 Maverick (Groq)

All models are queried in parallel and provide independent responses without knowing what other models said.

Args:
  - prompt (string): The question or problem you need help with
  - context (string, optional): Additional context to help models understand the situation
  - attachments (array, optional): File attachments (base64/data URL or http(s) URL) for supported file types
  - show_raw (boolean, optional): If true, omit synthesis fields and return only raw responses

Returns:
  JSON object with schema:
  {
    "critiques": [
      {
        "model": string,        // Model name
        "model_id": string,     // Concrete model identifier used
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
    },
    "synthesis_data": {         // Omitted when show_raw=true
      "agreement_points": string[],
      "disagreements": Array<{
        "topic": string,
        "positions": Array<{ "models": string[], "view": string }>
      }>,
      "key_insights": Array<{ "model": string, "insight": string }>,
      "confidence": number
    },
    "synthesis_instruction": string // Omitted when show_raw=true
  }

Examples:
  - Use when: You're stuck debugging a complex issue -> consult Council for alternative approaches
  - Use when: You need to make an architectural decision -> get multiple perspectives
  - Use when: You're uncertain about code correctness -> get critiques from different models

Error Handling:
  - Individual model failures are captured in the "error" field
  - The Council continues even if some models fail (partial results returned)
  - Returns error if Council is not initialized${
    deprecated ? '\n\nNote: This tool name is deprecated. Prefer `phone_council`.' : ''
  }`,
        inputSchema: PhoneCouncilInputSchema,
        annotations: {
          readOnlyHint: false, // Council queries external models
          destructiveHint: false, // No destructive operations
          idempotentHint: false, // Different responses each time
          openWorldHint: true, // Interacts with external AI services
        },
      },
      async (params: PhoneCouncilInput, extra) => {
        try {
          const result = await consultCouncil({
            prompt: params.prompt,
            context: params.context,
            attachments: params.attachments,
            show_raw: params.show_raw,
            signal: extra?.signal,
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
              lines.push(`**Model ID:** ${critique.model_id}`);
              lines.push(`**Error:** ${critique.error}`);
            } else {
              lines.push(`## ${critique.model} ✓`);
              lines.push(`**Model ID:** ${critique.model_id}`);
              lines.push(critique.response);
            }
            lines.push('');
          }

          if (result.synthesis_data) {
            lines.push('## Synthesis Summary');
            lines.push(`**Confidence:** ${Math.round(result.synthesis_data.confidence * 100)}%`);
            if (result.synthesis_data.agreement_points.length > 0) {
              lines.push('');
              lines.push('**Agreement Points:**');
              for (const point of result.synthesis_data.agreement_points) {
                lines.push(`- ${point}`);
              }
            }
            if (result.synthesis_data.disagreements.length > 0) {
              lines.push('');
              lines.push('**Disagreements:**');
              for (const disagreement of result.synthesis_data.disagreements) {
                lines.push(`- ${disagreement.topic}`);
              }
            }
            lines.push('');
          }

          const textContent = lines.join('\n');

          return {
            content: [{ type: 'text', text: textContent }],
            structuredContent: result as unknown as Record<string, unknown>, // Modern pattern for structured data
          };
        } catch (error) {
          throw toMcpError(error, config.debug);
        }
      }
    );

  registerCouncilTool('phone_council');
  registerCouncilTool('council_consult', true);
}

// Register tools on module load
registerMcpTools();
