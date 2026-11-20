import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TunarrClient } from "./client.js";
import type { TunarrMcpConfig } from "./config.js";
import { registerChannelsTools } from "./tools/channels.js";
import { registerCustomShowsTools } from "./tools/custom-shows.js";
import { registerFillerListsTools } from "./tools/filler-lists.js";
import { registerGuideTools } from "./tools/guide.js";
import { registerMediaSourcesTools } from "./tools/media-sources.js";
import { registerProgramsTools } from "./tools/programs.js";
import { registerSessionsTools } from "./tools/sessions.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerSemanticTools } from "./tools/semantic.js";
import { registerSmartCollectionsTools } from "./tools/smart-collections.js";
import { registerStreamingTools } from "./tools/streaming.js";
import { registerSystemTools } from "./tools/system.js";
import { registerTrashTools } from "./tools/trash.js";

export const SERVER_NAME = "tunarr-mcp";
export const SERVER_VERSION = "1.0.0";

/**
 * Server-level instructions sent to MCP clients during initialization.
 * Describes the Tunarr domain model and how its entities relate, so agents
 * can plan multi-tool workflows without trial and error.
 */
export const SERVER_INSTRUCTIONS = `
Tunarr is a self-hosted IPTV server that turns media libraries into linear TV
channels. How the entities relate:

- Media sources (Plex, Jellyfin, Emby, or local paths) are the origin of all
  content. Programs are mirrored from media sources and addressed either by
  their Tunarr-internal UUID or by an external ID (IMDb "tt...", "tmdb:123").
- Channels are the primary entity. Each channel has a schedule/lineup built
  from programs, custom shows, filler lists, or smart collections.
- Custom shows aggregate programs across media sources into one user-defined
  show. Filler lists are named pools of programs used to pad gaps between
  scheduled items (a channel references them via its fillerCollections
  configuration). Smart collections are keyword/filter-based dynamic program
  groupings that can be used wherever a lineup source is needed.
- The guide (EPG, exposed as XMLTV) is generated from channel schedules; after
  changing lineups, a guide refresh task may be required (list_tasks, then
  run_task).
- Sessions are live viewers/stream connections per channel; streaming tools
  expose M3U playlists, the XMLTV guide URL, and per-channel stream URLs for
  players such as VLC or Kodi.
- Deleted programs move to the trash before permanent cleanup; the trash tools
  (list_trash, get_trash_status, clear_trash) let you inspect it and, only when
  explicitly asked, empty it.

Typical flows:
- Discover content: list_media_sources -> lookup_program /
  lookup_by_external_id / batch_lookup_programs.
- Build a channel: create_channel with a lineup of programs or custom shows,
  optionally attach filler lists, then verify with get_channel_schedule and
  get_guide_status.
- Maintain: list_tasks + run_task for guide refreshes and metadata updates.

Safety: tools named create_/update_/scan_/run_ modify Tunarr state; tools
named delete_ permanently remove data. Three tools are destructive and
irreversible — clear_channel_schedule (wipes a channel's schedule),
clear_trash (permanently deletes all trashed programs), and
clear_channels_m3u_cache (invalidates the shared playlist cache) — confirm
with the user before calling them. Read-only tools never modify state.
All IDs are opaque strings; fetch them with the corresponding list_/get_
tools first. Responses are returned as JSON (or raw M3U/XMLTV text for
playlist tools).
`.trim();

export interface TunarrMcpServerHandle {
  server: McpServer;
  client: TunarrClient;
}

/**
 * Build a fully configured MCP server (all 114 Tunarr tools registered) that
 * is not yet connected to any transport. Shared by the stdio entry point
 * (src/index.ts) and the Streamable HTTP server (src/http.ts), which creates
 * one instance per MCP session.
 */
export function createTunarrMcpServer(
  config: TunarrMcpConfig,
  options: { name?: string; version?: string } = {},
): TunarrMcpServerHandle {
  const client = new TunarrClient({
    baseUrl: config.tunarrUrl,
    apiKey: config.apiKey,
  });

  const server = new McpServer(
    { name: options.name ?? SERVER_NAME, version: options.version ?? SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerChannelsTools(server, client);
  registerMediaSourcesTools(server, client);
  registerProgramsTools(server, client);
  registerCustomShowsTools(server, client);
  registerFillerListsTools(server, client);
  registerSmartCollectionsTools(server, client);
  registerSettingsTools(server, client);
  registerSessionsTools(server, client);
  registerGuideTools(server, client);
  registerStreamingTools(server, client);
  registerSystemTools(server, client);
  registerTrashTools(server, client);

  return { server, client };
}
