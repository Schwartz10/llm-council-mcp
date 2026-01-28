# LLM Council MCP - Technical Architecture Specification

## Overview

LLM Council MCP is a local MCP server + CLI that queries a council of frontier models in parallel and returns independent critiques plus structured synthesis data. It is designed for low-latency multi-model consultation with robust error handling and partial-failure tolerance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│              CLIENT LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   CLI    │  │  Claude  │  │  Other   │         │
│  │          │  │   Code   │  │ Clients  │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
└───────┼─────────────┼─────────────┼───────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│         COUNCIL DAEMON (Express Server)             │
│              localhost:3000                         │
│                                                     │
│  Endpoints:                                         │
│  • POST /mcp - MCP over streamable HTTP            │
│  • GET /health - Health check                      │
│                                                     │
│  Council: models query in parallel                 │
└─────────────────────────────────────────────────────┘
```

## Core Components

### 1) Configuration (`src/config.ts`)
- Loads API keys and runtime settings from `.env`.
- Defines the single source of truth for Council models via `COUNCIL_MODELS`.
- Supports per-provider fallback chains for graceful degradation.

### 2) Providers (`src/providers/`)
- Provider-specific implementations (Anthropic, OpenAI, Gemini, xAI, Groq).
- Model-agnostic design: each provider accepts a model ID at construction.
- Unified `Provider` interface with `query()` and `queryStream()`.

### 3) Council Module (`src/council/`)
- Orchestrates parallel requests with `Promise.allSettled()`.
- Handles partial failures and aggregates results.
- Emits progress callbacks for real-time UI updates.

### 4) MCP Server (`src/server/`)
- Express server with MCP SDK integration.
- Registers MCP tools and handles transport protocols (HTTP streamable, SSE, stdio).
- Implements sanitization, attachment handling, and structured responses.

### 5) CLI (`src/index.ts` + `src/ui.ts`)
- `llm-council` command-line interface.
- Uses MCP HTTP calls to consult the Council.
- Provides progress spinners and formatted output.

## Data Flow

```
User → CLI → /mcp (tools/call) → consult_llm_council
     → Council (parallel providers) → Aggregate critiques
     → Structured response (summary + synthesis_data)
```

## MCP Tools

### consult_llm_council
- **Purpose:** Query all or a subset of Council models in parallel.
- **Inputs:**
  - `prompt` (string, required)
  - `context` (string, optional)
  - `attachments` (array, optional)
  - `show_raw` (boolean, optional)
  - `models` (array, optional)
- **Outputs:**
  - `critiques[]`, `summary`, and optional `synthesis_data` + `synthesis_instruction`.

### list_models
- **Purpose:** List available model display names + IDs.
- **Outputs:** `models[]` with `name` and `model_id`.

## Environment Variables

Required API keys:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `GROQ_API_KEY`

Optional:
- `LLM_COUNCIL_DEBUG` (default: `false`)
- `LLM_COUNCIL_TIMEOUT_MS` (default: `30000`)
- `LLM_COUNCIL_REDACT_EMAILS` (default: `true`)
- `LLM_COUNCIL_ATTACHMENT_*` limits
- `LLM_COUNCIL_FALLBACK_COOLDOWN_MS` (default: `120000`)

## Repository Structure

```
llm-council-mcp/
├── src/
│   ├── index.ts         # CLI entry point
│   ├── config.ts        # Configuration + council model configs
│   ├── ui.ts            # Terminal UI helpers
│   ├── providers/       # Provider abstraction layer
│   ├── council/         # Parallel querying module
│   └── server/          # Express server with MCP integration
├── docs/
│   ├── SERVER.md        # Server setup guide
│   ├── MCP_SETUP.md     # Claude Code integration guide
│   └── SECURITY.md      # Security documentation
├── dist/                # Compiled JavaScript (after build)
├── package.json
└── tsconfig.json
```

## Non-Goals

- External network exposure (server binds to localhost by default).
- Automatic consensus or single-response synthesis outside of `synthesis_data` extraction.
