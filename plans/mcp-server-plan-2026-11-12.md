# Tunarr MCP Server Plan

## Objective

Build an MCP (Model Context Protocol) server that exposes the tunarr service API at `http://nas.homeserver.edu:30333/api/` as tools an LLM can use to configure channels, schedules, media sources, and settings.

No authentication is required on the running service.

## Architecture

```
tunarr-mcp/
├── package.json              # Node.js ESM project, pnpm
├── tsconfig.json             # TypeScript config (ES2022, strict)
├── vitest.config.ts          # Vitest config
├── src/
│   ├── index.ts              # MCP server entry point (stdio transport)
│   ├── client.ts             # HTTP client wrapper around tunarr API
│   ├── tools/
│   │   ├── channels.ts       # Channel CRUD + schedule/programming/fallbacks
│   │   ├── media-sources.ts  # Media source CRUD + libraries + scan/refresh
│   │   ├── programs.ts       # Program lookup, groups, batch operations
│   │   ├── custom-shows.ts   # Custom show CRUD + sync
│   │   ├── filler-lists.ts   # Filler list CRUD + programs
│   │   ├── smart-collections.ts # Smart collection CRUD
│   │   ├── settings.ts       # All settings endpoints (ffmpeg, hdhr, plex, xmltv, transcode, system)
│   │   ├── sessions.ts       # Active streaming sessions
│   │   ├── guide.ts          # Guide status and channel EPG data
│   │   ├── streaming.ts      # M3U/XMLTV playlist URLs
│   │   └── system.ts         # Health, version, tasks, fixers, logs, ffmpeg-info
│   └── types/
│       └── tunarr.ts         # Inferred TypeScript types from OpenAPI spec
├── tests/
│   ├── client.test.ts        # HTTP client unit tests (mocked fetch)
│   ├── channels.test.ts      # Channel tool tests
│   ├── media-sources.test.ts # Media source tool tests
│   ├── programs.test.ts      # Program tool tests
│   ├── custom-shows.test.ts  # Custom shows tool tests
│   ├── filler-lists.test.ts  # Filler lists tool tests
│   ├── smart-collections.test.ts # Smart collection tool tests
│   ├── settings.test.ts      # Settings tool tests
│   ├── sessions.test.ts      # Sessions tool tests
│   ├── guide.test.ts         # Guide tool tests
│   ├── streaming.test.ts     # Streaming tool tests
│   └── system.test.ts        # System tool tests
└── plans/
    └── mcp-server-plan-2026-11-12.md
```

## Tool Design Principles

Group the 111 raw API endpoints into ~15 high-level MCP tools. Each tool should be a logical operation an LLM would perform, not a raw API call:

| MCP Tool | Description | Underlying Endpoints |
|---|---|---|
| `list_channels` | Get all channels | GET /api/channels |
| `get_channel` | Get a single channel by ID | GET /api/channels/{id} |
| `create_channel` | Create a new channel | POST /api/channels |
| `update_channel` | Update channel settings | PUT /api/channels/{id} |
| `delete_channel` | Delete a channel | DELETE /api/channels/{id} |
| `list_media_sources` | Get all media sources | GET /api/media-sources |
| `get_media_source` | Get a specific media source | GET /api/media-sources/{id} |
| `create_media_source` | Add Plex/Jellyfin/Emby/local source | POST /api/media-sources |
| `update_media_source` | Update media source config | PUT /api/media-sources/{id} |
| `delete_media_source` | Remove a media source | DELETE /api/media-sources/{id} |
| `scan_media_source` | Scan a media source for new content | POST /api/media-sources/{id}/scan |
| `list_programs` | Search/lookup programs by ID or external ID | GET /api/programs/{id}, GET /api/programming/{externalId} |
| `get_channel_schedule` | Get schedule for a channel | GET /api/channels/{id}/schedule |
| `get_guide_status` | Check guide status and EPG data | GET /api/guide/status, GET /api/guide/channels |
| `list_sessions` | Get active streaming sessions | GET /api/sessions |
| `get_system_health` | System health, version, ffmpeg info | GET /api/system/health, GET /api/version, GET /api/ffmpeg-info |
| `get_settings` | Read any settings group | Multiple GET endpoints |
| `update_settings` | Update settings (transcode, HDHR, Plex, XMLTV, system) | Multiple PUT endpoints |

## Implementation Details

### HTTP Client (`src/client.ts`)

- Single class `TunarrClient` wrapping `fetch`
- Configurable base URL (default: `http://nas.homeserver.edu:30333/api`)
- No auth headers needed (confirmed)
- Typed request/response methods for each endpoint group
- Error handling: throw descriptive errors on non-2xx responses

### MCP Server (`src/index.ts`)

- Uses `@modelcontextprotocol/sdk` with `StdioServerTransport`
- Registers all tools using `server.registerTool()`
- Each tool has: name, description, inputSchema (Zod-like JSON Schema)
- Tools call through to the HTTP client

### Type Inference

- Use the OpenAPI spec at `docs/generated/tunarr-latest-openapi.json` from the tunarr repo to generate TypeScript types
- Generate minimal types needed for tool inputs/outputs — don't need all 18 schemas, just the ones used by MCP tools
- Types go in `src/types/tunarr.ts`

### Testing Strategy

Each tool file gets a corresponding test file. Tests use:
- Vitest with mocked `fetch` (no network calls)
- Mock responses based on real API response shapes from the OpenAPI spec
- Cover happy path, error cases, and edge cases for each tool
- Target: all MCP tools + client have 100% branch coverage

## Subagent Work Distribution

Three subagents work in parallel:

### Subagent A — Client & Types
- `src/client.ts` — HTTP client with methods for every endpoint group
- `src/types/tunarr.ts` — TypeScript types inferred from OpenAPI spec
- `tests/client.test.ts` — Client unit tests

### Subagent B — Tools
- All 18 tool files in `src/tools/`
- Each tool: MCP registration, input schema, description, calls client
- `tests/*.test.ts` for each tool (mocked fetch)

### Subagent C — Config & Integration
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/index.ts` — MCP server entry point wiring everything together
- Integration test that validates all tools are registered
- README.md with usage instructions

## Key Decisions

1. **No auth** — confirmed the service responds without credentials
2. **stdio transport** — standard MCP pattern, works with any MCP client
3. **Grouped tools over raw endpoints** — 18 logical tools instead of 111 raw API calls
4. **Mock-based tests** — no dependency on running tunarr for CI/test correctness
5. **TypeScript only** — types inferred from OpenAPI, strict mode enabled
