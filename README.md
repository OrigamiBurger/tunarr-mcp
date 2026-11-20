# tunarr-mcp

An [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that
exposes [Tunarr](https://github.com/DrunkToast/Tunarr) — a self-hosted IPTV
server that turns media libraries (Plex, Jellyfin, Emby, local paths) into
linear TV channels — as a set of MCP tools.

The server speaks **Streamable HTTP** as its primary transport and **stdio** as
a secondary transport. Both share the same 55 tools, which are wired up in
[`src/server.ts`](src/server.ts) and split one module per concern under
[`src/tools/`](src/tools/). It talks to a Tunarr instance over HTTP using a thin
typed client ([`src/client.ts`](src/client.ts)); every tool is declared with a
Zod [`inputSchema`](https://modelcontextprotocol.io/developer/tools/schema-validation)
so the model receives structured, validated arguments and gets a clear error
when they are missing or malformed.

- **55 tools** grouped into 11 concerns: channels, custom-shows, filler-lists,
  guide, media-sources, programs, sessions, settings, smart-collections,
  streaming, and system.
- **Read-mostly by default**: mutations (create/update/delete) return the
  resulting resource or a confirmation message.
- **Explicit argument schemas** for every tool that takes input, so missing or
  wrong-typed arguments are rejected before a network call is made.

## Requirements

- Node.js **>= 20** (built and tested on Node 22; uses the global `fetch` and ESM).
- **pnpm 11** (declared in [`package.json`](package.json) `devEngines`).
- A reachable **Tunarr** server and its base URL (`TUNARR_URL`).

## Configuration

Configuration is entirely environment-driven and validated at startup by
[`src/config.ts`](src/config.ts).

| Variable           | Default   | Required | Notes                                                                                  |
| ------------------ | --------- | -------- | -------------------------------------------------------------------------------------- |
| `TUNARR_URL`       | —         | **yes**  | Root URL of the Tunarr server, e.g. `http://tunarr:8409`. The client appends `/api/...` itself; a trailing slash is stripped and is otherwise OK. |
| `TUNARR_BASE_URL`  | —         | no       | Still accepted for backward compatibility (used only when `TUNARR_URL` is unset).      |
| `TUNARR_API_KEY`   | —         | no       | Tunarr needs no auth today; when set, it is sent to Tunarr as `Authorization: Bearer <key>`. |
| `PORT`             | `3001`    | no       | TCP port for the Streamable HTTP MCP server. Must be an integer between 1 and 65535.   |
| `HOST`             | `0.0.0.0` | no       | Bind address for the HTTP server.                                                      |

Invalid configuration fails **fast at startup**: a `ConfigError` with an
actionable message is written to **stderr** and the process exits with code
**1** (e.g. a missing `TUNARR_URL`, a non-`http(s)` URL, or a non-integer port).

## Development

```bash
pnpm install          # install dependencies
pnpm dev              # run the Streamable HTTP server (tsx src/http.ts) on PORT
pnpm dev:stdio        # run the stdio server (tsx src/index.ts)
pnpm typecheck        # tsc --noEmit across src/  (equivalent to node_modules/.bin/tsc --noEmit)
pnpm test             # vitest run across tests/**/*.test.ts
pnpm build            # tsc -> dist/
```

## Production

```bash
pnpm build            # compile TypeScript to dist/
pnpm start            # node dist/http.js  (Streamable HTTP, primary transport)
pnpm start:stdio      # node dist/index.js (stdio, secondary transport)
```

### Docker

```bash
docker build -t tunarr-mcp .
docker compose up -d
```

The multi-stage [`Dockerfile`](Dockerfile) builds on `node:22-alpine` (compiled
with the locally installed TypeScript, then pruned to a non-root runtime image)
and runs `node dist/http.js` by default. It exposes **3001** and defines a
`HEALTHCHECK` against the server's `/healthz` endpoint.

[`docker-compose.yml`](docker-compose.yml) defines a single `tunarr-mcp`
service mapped to **`3001:3001`** and requires `TUNARR_URL` (an unset value
makes `docker compose up` fail fast). Optional `TUNARR_API_KEY`, `PORT`, and
`HOST` are also accepted.

**Reaching Tunarr from the container:**

- **Tunarr on the Docker host** → set `TUNARR_URL=http://host.docker.internal:8409`.
  The compose file adds `extra_hosts: host.docker.internal:host-gateway` so the
  container can resolve the host.
- **Tunarr elsewhere** → set `TUNARR_URL` to that server's routable URL.

## MCP client configuration

### stdio (DSH / generic)

The stdio transport expects a **built** entry point (`dist/index.js`):

```json
{
  "mcpServers": {
    "tunarr": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "TUNARR_URL": "http://tunarr:8409"
      }
    }
  }
}
```

See [`mcp-config.json`](mcp-config.json) for a ready-to-edit example.

### Streamable HTTP (generic clients)

Point a Streamable HTTP client at:

```
http://<host>:3001/mcp
```

This is a **stateful** session transport: each client session is keyed by the
`mcp-session-id` header. A `POST /mcp` without a session ID is treated as an
`initialize` request and opens a new session; subsequent requests carry the
returned `mcp-session-id`.

## Verification

```bash
curl http://localhost:3001/healthz   # -> 200, body "ok"
```

1. Start the server (`pnpm dev`, `pnpm start`, or the Docker image).
2. Connect an MCP client and **list tools** — expect **55** tools with flat
   snake_case names such as `list_channels` and `get_version`.
3. Call an example tool, e.g. `tools/call get_version`, which returns the Tunarr,
   FFmpeg, and Node versions.

## The 55 tools

Tool names are flat, snake_case verbs (`list_channels`, `get_channel`,
`create_channel`, …) — there is no namespace prefix. Tools without listed arguments
take none. Responses are returned as a single `content` item of `type: "text"`
containing JSON (or raw M3U/XMLTV text for the playlist tools); errors surface
as MCP error responses wrapping the underlying `TunarrError`.

### Channels — `src/tools/channels.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_channels` | — | List all configured TV channels. |
| `get_channel` | `id` | Full configuration for one channel. |
| `create_channel` | `body` | Create a channel (`name`, `type`, optional `number`, `groupTitle`, …). |
| `update_channel` | `id`, `body` | Update channel fields. |
| `delete_channel` | `id` | Delete a channel permanently. |
| `get_channel_schedule` | `channelId` | Schedule configuration (time slots, flex settings). |

### Media Sources — `src/tools/media-sources.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_media_sources` | — | List Plex/Jellyfin/Emby/local sources. |
| `get_media_source` | `id` | Details for one source (libraries, path replacements). |
| `create_media_source` | `body` | Create a source (`name`, `uri`, `type`, `accessToken`, `userId`, `libraries`, …). |
| `update_media_source` | `id`, `body` | Update source fields. |
| `delete_media_source` | `id` | Delete a source and its library mappings. |
| `scan_media_source` | `id` | Trigger a library scan. |
| `get_media_source_status` | `id` | Scan progress, library counts, connection health. |

### Programs — `src/tools/programs.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `lookup_program` | `id` | Program by its internal tunarr UUID. |
| `lookup_by_external_id` | `externalId` | Program by external ID (IMDb/TMDb/TVDb, e.g. `"tt0133093"`). |
| `get_program_children` | `id` | Child programs of a parent (e.g. episodes of a season). |
| `batch_lookup_programs` | `externalIds` | Look up multiple programs by external ID in one call. |

### Custom Shows — `src/tools/custom-shows.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_custom_shows` | — | List user-defined aggregations of content. |
| `get_custom_show` | `id` | Details for one custom show. |
| `create_custom_show` | `body` | Create a custom show (`name`, `syncMediaSourceId`, `syncInterval`, `programs`, …). |
| `update_custom_show` | `id`, `body` | Update custom show fields. |
| `delete_custom_show` | `id` | Delete a custom show. |

### Filler Lists — `src/tools/filler-lists.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_filler_lists` | — | List named collections of filler programs. |
| `get_filler_list` | `id` | Details for one filler list. |
| `create_filler_list` | `body` | Create a filler list (`name`, `programs`, …). |
| `update_filler_list` | `id`, `body` | Update filler list fields. |
| `delete_filler_list` | `id` | Delete a filler list. |

### Smart Collections — `src/tools/smart-collections.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_smart_collections` | — | List filter/keyword-based collections. |
| `get_smart_collection` | `id` | Details for one collection (rules, keywords). |
| `create_smart_collection` | `body` | Create a collection (`name`, `keywords`, `filterString`/`filter`, …). |
| `update_smart_collection` | `id`, `body` | Update collection fields. |
| `delete_smart_collection` | `id` | Delete a collection. |

### Settings — `src/tools/settings.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `get_settings` | `type` | Read settings of a type: `ffmpeg`, `hdhr`, `plex`, `xmltv`, `transcode_configs`, `media-source`, `system`, `feature-flags`. |
| `update_ffmpeg_settings` | `body` | Update FFmpeg settings (`ffmpegExecutablePath`, `logLevel`, …). |
| `update_hdhr_settings` | `body` | Update HDHomeRun settings (`autoDiscoveryEnabled`, `tunerCount`). |
| `update_plex_settings` | `body` | Update Plex settings (`streamPath`, `updatePlayStatus`, `pathReplace`, …). |
| `update_xmltv_settings` | `body` | Update XMLTV/EPG settings (`programmingHours`, `refreshHours`, `outputPath`, …). |
| `get_transcode_configs` | — | List transcode configurations. |
| `create_transcode_config` | `body` | Create a transcode config (`name`, `threadCount`, `hardwareAccelerationMode`, `resolution`, …). |
| `update_transcode_config` | `id`, `body` | Update a transcode config. |

### Sessions — `src/tools/sessions.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `list_sessions` | — | Active streaming sessions across all channels. |
| `get_channel_sessions` | `channelId` | Active sessions for one channel. |
| `delete_channel_sessions` | `channelId` | Force-stop all sessions for a channel. |

### Guide / EPG — `src/tools/guide.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `get_guide_status` | — | EPG status: last refresh, progress, channel coverage. |
| `list_guide_channels` | — | Channels that have guide data. |
| `get_guide_channel` | `id` | Guide data for one channel. |

### Streaming — `src/tools/streaming.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `get_m3u_playlist` | — | Raw M3U playlist text for all channels. |
| `get_xmltv_playlist` | — | Raw XMLTV/EPG text for all channels. |
| `get_channel_stream_url` | `id` | Direct stream URL for one channel. |

### System — `src/tools/system.ts`

| Tool | Arguments | Purpose |
| ---- | --------- | ------- |
| `get_system_health` | — | Health entries per subsystem (healthy/info/warning/error). |
| `get_version` | — | Versions of tunarr, FFmpeg, and Node. |
| `get_ffmpeg_info` | — | Available video/audio encoders. |
| `list_tasks` | — | Available background tasks/jobs. |
| `run_task` | `taskId` | Manually trigger a background task. |
| `get_system_state` | — | Runtime status, active processes, memory usage, config summary. |

## Limitations

- **No MCP-server-side auth on `/mcp`.** The Streamable HTTP endpoint accepts
  connections from anyone who can reach it; protect it with network-level
  controls (firewall, reverse proxy, TLS, etc.).
- **No DNS-rebinding host allowlist.** The server will talk to whatever host
  `TUNARR_URL` names, so SSRF-style host confusion is not mitigated server-side.
- **Sessions are in-memory on a single node.** Streamable HTTP sessions are not
  persisted and cannot be shared across instances, so the server does not
  horizontally scale behind multiple replicas.
- **HTTP sessions are dropped on restart.** Clients must re-run `initialize`
  (and reconnect) after the server restarts; the previous `mcp-session-id`
  returns `404 Session not found`.

## Project structure

```
src/
  index.ts             # stdio entry point (secondary transport)
  http.ts              # Streamable HTTP entry point (primary transport)
  server.ts            # Wires all tool groups onto an McpServer
  client.ts            # TunarrClient: typed request() helper over the Tunarr REST API
  config.ts            # Environment-driven config + validation (ConfigError)
  types/tunarr.ts      # Shared TypeScript types for Tunarr API shapes
  tools/               # One module per concern, each exporting a register*Tools()
tests/                 # Vitest suites; helpers.ts provides the fetch mock
```
