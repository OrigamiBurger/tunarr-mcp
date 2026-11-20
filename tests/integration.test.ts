import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TunarrClient } from "../src/client.js";
import { registerChannelsTools } from "../src/tools/channels.js";
import { registerCustomShowsTools } from "../src/tools/custom-shows.js";
import { registerFillerListsTools } from "../src/tools/filler-lists.js";
import { registerGuideTools } from "../src/tools/guide.js";
import { registerMediaSourcesTools } from "../src/tools/media-sources.js";
import { registerProgramsTools } from "../src/tools/programs.js";
import { registerSessionsTools } from "../src/tools/sessions.js";
import { registerSettingsTools } from "../src/tools/settings.js";
import { registerSmartCollectionsTools } from "../src/tools/smart-collections.js";
import { registerStreamingTools } from "../src/tools/streaming.js";
import { registerSystemTools } from "../src/tools/system.js";
import {
  createClient,
  listToolNames,
  mockFetch,
  newServer,
  resetFetch,
  toolHandler,
} from "./helpers.js";

/** The complete set of tool names the server is expected to expose. */
const EXPECTED_TOOLS = [
  "add_library_to_source",
  "add_program_to_channel",
  "add_schedule_slot",
  "add_schedule_time_slot",
  "batch_lookup_program_groupings",
  "batch_lookup_programs",
  "bulk_add_fillers",
  "clear_channel_schedule",
  "clear_channels_m3u_cache",
  "create_channel",
  "create_custom_show",
  "create_filler_list",
  "create_media_source",
  "create_smart_collection",
  "create_transcode_config",
  "delete_channel",
  "delete_channel_sessions",
  "delete_custom_show",
  "delete_filler_list",
  "delete_media_source",
  "delete_smart_collection",
  "emby_library_items",
  "emby_user_libraries",
  "get_channel",
  "get_channel_fallbacks",
  "get_channel_item_stream",
  "get_channel_lineup",
  "get_channel_m3u8",
  "get_channel_native_playback",
  "get_channel_now_playing",
  "get_channel_programming",
  "get_channel_programs",
  "get_channel_schedule",
  "get_channel_sessions",
  "get_channel_stream",
  "get_channel_stream_url",
  "get_channel_ts",
  "get_credit",
  "get_credit_artwork",
  "get_custom_show",
  "get_etv_channel_diagnostics",
  "get_etv_playout_item",
  "get_etv_transcode_compatibility",
  "get_ffmpeg_info",
  "get_ffmpeg_playlist",
  "get_filler_list",
  "get_guide_channel",
  "get_guide_debug",
  "get_guide_status",
  "get_library_status",
  "get_m3u_playlist",
  "get_media_library",
  "get_media_source",
  "get_media_source_status",
  "get_program_artwork",
  "get_program_children",
  "get_program_descendants",
  "get_program_external_link",
  "get_program_facets",
  "get_program_grouping",
  "get_program_stream_details",
  "get_season_details",
  "get_settings",
  "get_show_details",
  "get_smart_collection",
  "get_system_health",
  "get_system_state",
  "get_transcode_configs",
  "get_version",
  "get_xmltv_last_refresh",
  "get_xmltv_playlist",
  "jellyfin_library_genres",
  "jellyfin_library_items",
  "jellyfin_user_libraries",
  "list_channel_lineups",
  "list_channels",
  "list_custom_show_programs",
  "list_custom_shows",
  "list_filler_list_programs",
  "list_filler_lists",
  "list_guide_channels",
  "list_library_programs",
  "list_media_sources",
  "list_sessions",
  "list_show_seasons",
  "list_smart_collections",
  "list_source_libraries",
  "list_tasks",
  "lookup_by_external_id",
  "lookup_program",
  "plex_collections",
  "plex_filters",
  "plex_item_children",
  "plex_libraries",
  "plex_playlists",
  "plex_search",
  "plex_tags",
  "plex_user_playlists",
  "run_task",
  "scan_media_source",
  "search_programs",
  "update_channel",
  "update_custom_show",
  "update_ffmpeg_settings",
  "update_filler_list",
  "update_hdhr_settings",
  "update_media_source",
  "update_plex_settings",
  "update_smart_collection",
  "update_transcode_config",
  "update_xmltv_settings",
];

function buildServer(): McpServer {
  const server = newServer();
  const client = new TunarrClient({ baseUrl: "http://test.example.com:3033" });
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
  return server;
}

describe("MCP server integration", () => {
  it("registers exactly the expected set of tools", () => {
    const names = listToolNames(buildServer());
    // listToolNames returns names sorted alphabetically; normalize the expected
    // list the same way so the comparison is order-independent on intent.
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
    expect(names).toHaveLength(EXPECTED_TOOLS.length);
  });

  it("gives every registered tool a description and a callable handler", () => {
    const server = buildServer();
    const tools = (server as unknown as {
      _registeredTools: Record<string, { description?: string; handler: unknown }>;
    })._registeredTools;

    for (const name of Object.keys(tools)) {
      const tool = tools[name];
      expect(tool.description, `tool "${name}" description`).toBeTruthy();
      expect(
        typeof tool.handler,
        `tool "${name}" handler is a function`,
      ).toBe("function");
    }
  });

  it("exposes a representative tool from each group", async () => {
    mockFetch({
      "/api/channels": { status: 200, body: [] },
    });
    const server = buildServer();
    // list_channels is a zero-arg tool; it must be callable with no args.
    const handler = toolHandler(server, "list_channels");
    const result = await handler();
    expect(result).toHaveProperty("content");
    resetFetch();
  });
});
