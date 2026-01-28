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
import { COUNCIL_MODELS } from '../../council.config.js';
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

const MODEL_ALIASES: Record<string, string> = {
  claude: 'Claude Sonnet 4.5',
  gpt: 'GPT',
  gemini: 'Gemini',
  grok: 'Grok',
  llama: 'Llama 4 Maverick',
};

const configuredModelsByName = new Map(
  COUNCIL_MODELS.map((model) => [normalizeModelName(model.name), model.name])
);

function normalizeModelName(value: string): string {
  return value.trim().toLowerCase();
}

export function selectCouncilProviders(
  requestedModels: string[] | undefined,
  providers: Provider[]
): Provider[] {
  if (!requestedModels || requestedModels.length === 0) {
    return providers;
  }

  const providersByName = new Map(
    providers.map((provider) => [normalizeModelName(provider.name), provider])
  );
  const selected: Provider[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  const unavailable: string[] = [];

  for (const rawModel of requestedModels) {
    const normalized = normalizeModelName(rawModel);
    if (!normalized) {
      continue;
    }

    const directProvider = providersByName.get(normalized);
    if (directProvider) {
      if (!seen.has(directProvider.name)) {
        selected.push(directProvider);
        seen.add(directProvider.name);
      }
      continue;
    }

    const canonicalName = MODEL_ALIASES[normalized] ?? configuredModelsByName.get(normalized);

    if (!canonicalName) {
      unknown.push(rawModel);
      continue;
    }

    const provider = providersByName.get(normalizeModelName(canonicalName));
    if (!provider) {
      unavailable.push(canonicalName);
      continue;
    }

    if (!seen.has(provider.name)) {
      selected.push(provider);
      seen.add(provider.name);
    }
  }

  if (unknown.length > 0 || unavailable.length > 0) {
    const availableNames = providers.map((provider) => provider.name).sort();
    const unknownList = Array.from(new Set(unknown));
    const unavailableList = Array.from(new Set(unavailable));

    let message = 'Requested models are not available.';
    if (unknownList.length > 0) {
      message += ` Unknown model name(s): ${unknownList.join(', ')}.`;
    }
    if (unavailableList.length > 0) {
      message += ` Not configured or unavailable: ${unavailableList.join(', ')}.`;
    }
    message += ` Available models: ${availableNames.join(', ') || 'none'}.`;
    throw new Error(message);
  }

  if (selected.length === 0) {
    throw new Error('No matching Council models found for the request.');
  }

  return selected;
}

export function listCouncilModels(
  providers: Provider[]
): Array<{ name: string; model_id: string }> {
  return providers.map((provider) => ({
    name: provider.name,
    model_id: provider.modelId,
  }));
}

// Zod schema for consult_llm_council tool input
const ConsultLlmCouncilInputSchema = z
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
    models: z
      .array(z.string().min(1))
      .optional()
      .describe('Optional list of model identifiers to consult (e.g., ["claude", "gpt"])'),
  })
  .strict();

type ConsultLlmCouncilInput = z.infer<typeof ConsultLlmCouncilInputSchema>;

const ListModelsInputSchema = z.object({}).strict();
type ListModelsInput = z.infer<typeof ListModelsInputSchema>;

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
    throw new Error('LLM Council not initialized. Please wait for server startup.');
  }

  const selectedProviders = selectCouncilProviders(request.models, councilProviders);

  return consultCouncilWithProviders(request, selectedProviders);
}

// Create shared MCP server instance
export const mcpServer = new McpServer({
  name: 'llm-council-mcp-server',
  version: '1.0.0',
});

/**
 * Register all MCP tools on the shared server instance
 */
export function registerMcpTools(): void {
  mcpServer.registerTool(
    'consult_llm_council',
    {
      title: 'Consult LLM Council',
      description: `Consult the LLM Council for alternative perspectives, critiques, and suggestions from multiple frontier AI models.

The LLM Council MCP server queries a Council of models in parallel and returns independent responses plus structured synthesis data.

The Council consists of:
- Claude Sonnet 4.5 (Anthropic)
- GPT-5.2 / GPT-4o (OpenAI)
- Gemini (Google)
- Grok 3 Beta (xAI)
- Llama 4 Maverick (Groq)

Args:
  - prompt (string): The question or problem you need help with
  - context (string, optional): Additional context to help models understand the situation
  - attachments (array, optional): File attachments (base64/data URL or http(s) URL) for supported file types
  - show_raw (boolean, optional): If true, omit synthesis fields and return only raw responses
  - models (array, optional): Subset of models to consult (e.g., ["claude", "gpt"])
    Accepted identifiers: claude, gpt, gemini, grok, llama (case-insensitive), or full display names.

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
  - Use when: You're stuck debugging a complex issue -> consult the LLM Council for alternative approaches
  - Use when: You need to make an architectural decision -> get multiple perspectives
  - Use when: You're uncertain about code correctness -> get critiques from different models
  - Use when: You want to limit cost/speed -> specify a subset with models

Error Handling:
  - Individual model failures are captured in the "error" field
  - The Council continues even if some models fail (partial results returned)
  - Returns error if LLM Council is not initialized`,
      inputSchema: ConsultLlmCouncilInputSchema,
      annotations: {
        readOnlyHint: false, // Council queries external models
        destructiveHint: false, // No destructive operations
        idempotentHint: false, // Different responses each time
        openWorldHint: true, // Interacts with external AI services
      },
    },
    async (params: ConsultLlmCouncilInput, extra) => {
      try {
        const result = await consultCouncil({
          prompt: params.prompt,
          context: params.context,
          attachments: params.attachments,
          show_raw: params.show_raw,
          models: params.models,
          signal: extra?.signal,
        });

        // Format as both text (markdown) and structured data
        const lines = [
          '# LLM Council Consultation Results',
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

  mcpServer.registerTool(
    'list_models',
    {
      title: 'List LLM Council Models',
      description: `List the currently available LLM Council models by name.

Use this tool to discover the exact model names that can be passed to consult_llm_council.

Returns:
  JSON object with schema:
  {
    "models": [
      {
        "name": string,        // Display name (e.g., "Claude Sonnet 4.5")
        "model_id": string     // Concrete model identifier used (e.g., "claude-sonnet-4-5-20250929")
      }
    ]
  }`,
      inputSchema: ListModelsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (_params: ListModelsInput) => {
      if (!councilInitialized || councilProviders.length === 0) {
        throw new Error('LLM Council not initialized. Please wait for server startup.');
      }

      const models = listCouncilModels(councilProviders);
      const lines = ['# Available Council Models', ''];
      for (const model of models) {
        lines.push(`- ${model.name} (${model.model_id})`);
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { models },
      };
    }
  );
}

// Register tools on module load
registerMcpTools();
