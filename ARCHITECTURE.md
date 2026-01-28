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

### 1) Configuration (`src/config.ts` + `council.config.ts`)
- `src/config.ts` loads API keys and runtime settings from `.env`.
- `council.config.ts` defines the single source of truth for Council models via `COUNCIL_MODELS`.
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

## Configuration

See `docs/CONFIGURATION.md` for environment variables and model selection (`council.config.ts`).

## Repository Structure

```
llm-council-mcp/
├── council.config.ts   # Council model configuration (user-editable)
├── src/
│   ├── index.ts         # CLI entry point
│   ├── config.ts        # Environment/runtime configuration
│   ├── ui.ts            # Terminal UI helpers
│   ├── providers/       # Provider abstraction layer
│   ├── council/         # Parallel querying module
│   └── server/          # Express server with MCP integration
├── docs/
│   ├── CONFIGURATION.md # Configuration reference
│   ├── CLI.md           # CLI usage
│   ├── MCP_SETUP.md     # MCP client setup
│   ├── SERVER.md        # Server operations
│   └── SECURITY.md      # Security documentation
├── dist/                # Compiled JavaScript (after build)
├── package.json
└── tsconfig.json
```

## Non-Goals

- External network exposure (server binds to localhost by default).
- Automatic consensus or single-response synthesis outside of `synthesis_data` extraction.
