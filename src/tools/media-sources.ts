import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MediaSource } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";
import {
  add_library_to_sourceBodySchema,
  create_media_sourceBodySchema,
  update_media_sourceBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerMediaSourcesTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_media_sources",
    {
      description:
        "List all configured media sources (Plex, Jellyfin, Emby, or local). Media sources are the origin of all content in Tunarr: their programs are addressed by Tunarr-internal UUIDs or external IDs, and they feed channels, custom shows, filler lists, and smart collections. Use this to obtain media source IDs for the get, update, delete, scan, and status tools. This is a read-only lookup and returns the array of media source objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sources = await client.getMediaSources();
      return {
        content: [{ type: "text", text: JSON.stringify(sources, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_media_source",
    {
      description:
        "Get detailed information about a specific media source by its ID, including its libraries, path replacements, and connection details. Media sources (Plex, Jellyfin, Emby, local) are the origin of all content in Tunarr. This is a read-only lookup; get available IDs via list_media_sources and it returns the full media source object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const source = await client.getMediaSource(id);
      return {
        content: [{ type: "text", text: JSON.stringify(source, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_media_source",
    {
      description:
        "Create a new media source, the origin of all content in Tunarr. Specify a name, uri, and type ('plex', 'jellyfin', 'emby', or 'local'); for remote sources include authentication tokens. This mutates Tunarr by creating a new entity and returns the newly created media source object as JSON. After creation, run scan_media_source so Tunarr discovers the source's programs.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        name: z.string().optional().describe("The media source name"),
        uri: z.string().optional().describe("The media source connection address (required for remote sources)"),
        accessToken: z.string().optional().describe("Authentication token for the source"),
        userId: z.string().optional().describe("The source user ID"),
        username: z.string().optional().describe("The source username"),
        sendPlayStatusUpdates: z.boolean().optional().describe("Whether to send playback status updates"),
        body: create_media_sourceBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields (type, pathReplacements, etc.)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        create_media_sourceBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          uri: f.uri as string | undefined,
          accessToken: f.accessToken as string | undefined,
          userId: f.userId as string | undefined,
          username: f.username as string | undefined,
          sendPlayStatusUpdates: f.sendPlayStatusUpdates as boolean | undefined,
        }),
      );
      const source = await client.createMediaSource(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(source, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_media_source",
    {
      description:
        "Update an existing media source's configuration, such as its name, uri, credentials, or library mappings, without recreating it. Get the media source ID via list_media_sources and only include the fields you want to change. This mutates the media source in place and returns the updated media source object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The media source ID to update (get available IDs via list_media_sources)"),
        name: z.string().optional().describe("The media source name"),
        uri: z.string().optional().describe("The media source connection address (required for remote sources)"),
        accessToken: z.string().optional().describe("Authentication token for the source"),
        userId: z.string().optional().describe("The source user ID"),
        username: z.string().optional().describe("The source username"),
        sendPlayStatusUpdates: z.boolean().optional().describe("Whether to send playback status updates"),
        body: update_media_sourceBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields (type, pathReplacements, etc.)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_media_sourceBodySchema,
        (f) => ({
          id: f.id as string | undefined,
          name: f.name as string | undefined,
          uri: f.uri as string | undefined,
          accessToken: f.accessToken as string | undefined,
          userId: f.userId as string | undefined,
          username: f.username as string | undefined,
          sendPlayStatusUpdates: f.sendPlayStatusUpdates as boolean | undefined,
        }),
      );
      const source = await client.updateMediaSource(args.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(source, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_media_source",
    {
      description:
        "Permanently delete a media source by its ID, removing the source and all associated library mappings. This is a destructive, irreversible operation: programs from this source become unresolvable in channels and other entities that use them, so verify the ID with list_media_sources first. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The media source ID to delete (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      await client.deleteMediaSource(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Media source ${id} deleted` }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "scan_media_source",
    {
      description:
        "Trigger a library scan on a media source so Tunarr re-reads its content and refreshes metadata. Use this after adding new content to the source, after creating or updating it, or when program listings appear stale. This mutates Tunarr state by starting a scan; it returns a JSON confirmation with success and a message rather than the scan results.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The media source ID to scan (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      await client.scanMediaSource(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Scan triggered for media source ${id}` }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_media_source_status",
    {
      description:
        "Get the current status of a media source, including scan progress, library counts, and connection health. Use this to monitor an in-progress scan or to diagnose connectivity problems with the source; get the ID via list_media_sources. This is a read-only lookup and returns the status object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const status = await client.getMediaSourceStatus(id);
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_source_libraries",
    {
      description:
        "List the libraries indexed from a specific media source. Libraries are the content collections Tunarr reads from a source (Plex, Jellyfin, Emby, or local) and their programs feed channels, custom shows, and filler lists. Use this to obtain library IDs for the get, scan, and other library tools; get the media source ID via list_media_sources. This is a read-only lookup and returns the array of library objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const libraries = await client.listSourceLibraries(id);
      return {
        content: [{ type: "text", text: JSON.stringify(libraries, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_library_status",
    {
      description:
        "Get the status of a specific library within a media source, including scan progress, item counts, and last scan time. Use this to monitor an in-progress library scan or diagnose connectivity with the source; get the media source ID via list_media_sources and the library ID via list_source_libraries. This is a read-only lookup and returns the library status object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The library ID (get available IDs via list_source_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const status = await client.getLibraryStatus(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_media_library",
    {
      description:
        "Get detailed information about a specific media library by its ID, including its contents, settings, and connection details. Libraries are the content collections Tunarr reads from a media source and their programs feed channels, custom shows, and filler lists. This is a read-only lookup; get available library IDs via list_source_libraries and it returns the full media library object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        libraryId: z
          .string()
          .describe("The library ID (get available IDs via list_source_libraries)"),
      },
    },
    async ({ libraryId }) => {
      const library = await client.getMediaLibrary(libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(library, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_library_programs",
    {
      description:
        "List the programs contained in a specific media library. Programs are the building blocks of channel lineups, custom shows, and filler lists and are addressed by Tunarr-internal UUIDs. Use this to obtain program IDs from a library; get the library ID via list_source_libraries. This is a read-only lookup and returns the array of program objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        libraryId: z
          .string()
          .describe("The library ID (get available IDs via list_source_libraries)"),
      },
    },
    async ({ libraryId }) => {
      const programs = await client.listLibraryPrograms(libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(programs, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_libraries",
    {
      description:
        "List the libraries available on a Plex media source, exposing them for scanning and browsing. Plex is one of the media source types Tunarr supports and its libraries feed channels, custom shows, and filler lists. Use this to obtain Plex library IDs for the plex, jellyfin, and emby tools; get the media source ID via list_media_sources. This is a read-only lookup and returns the array of Plex library objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const libraries = await client.plexLibraries(id);
      return {
        content: [{ type: "text", text: JSON.stringify(libraries, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_item_children",
    {
      description:
        "Get the child items beneath a specific Plex item, for example the seasons of a show or the episodes of a season. Plex is one of the media source types Tunarr supports; use this to expand a Plex item into the individual items it contains. The parentType is required to interpret the item (e.g. 'show', 'season'); get the media source ID via list_media_sources and the item ID via plex_libraries or plex_collections. This is a read-only lookup and returns the array of child items as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        itemId: z.string().describe("The Plex item ID to expand children for"),
        parentType: z
          .string()
          .describe("The type of the parent item, required, e.g. 'show', 'season'"),
      },
    },
    async ({ mediaSourceId, itemId, parentType }) => {
      const children = await client.plexItemChildren(mediaSourceId, itemId, parentType);
      return {
        content: [{ type: "text", text: JSON.stringify(children, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_collections",
    {
      description:
        "List the collections available within a Plex library, exposing them for browsing. Plex is one of the media source types Tunarr supports; use this to obtain Plex collection IDs for plex_item_children, plex_playlists, or plex_search. Get the media source ID via list_media_sources and the library ID via plex_libraries or list_source_libraries. This is a read-only lookup and returns the array of Plex collection objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The Plex library ID (get available IDs via plex_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const collections = await client.plexCollections(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_playlists",
    {
      description:
        "List the playlists available within a Plex library, exposing them for browsing. Plex is one of the media source types Tunarr supports; use this to obtain Plex playlist IDs for plex_item_children or plex_search. Get the media source ID via list_media_sources and the library ID via plex_libraries or list_source_libraries. This is a read-only lookup and returns the array of Plex playlist objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The Plex library ID (get available IDs via plex_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const playlists = await client.plexPlaylists(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(playlists, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_user_playlists",
    {
      description:
        "List the playlists owned by the user attached to a Plex media source, exposing them for browsing. Plex is one of the media source types Tunarr supports; use this to obtain Plex user playlist IDs for plex_item_children or plex_search. Get the media source ID via list_media_sources. This is a read-only lookup and returns the array of Plex user playlist objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const playlists = await client.plexUserPlaylists(id);
      return {
        content: [{ type: "text", text: JSON.stringify(playlists, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_search",
    {
      description:
        "Search a Plex media source for items using a Plex hub search key, optionally narrowed by a search parameter, offset, limit, or parent type. Plex is one of the media source types Tunarr supports; results can be expanded with plex_item_children or browsed via plex_collections and plex_playlists. Get the media source ID via list_media_sources. The search key is required; the other parameters are optional. This is a read-only lookup and returns the search results as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        key: z.string().describe("Required Plex search key (Plex hub search key)"),
        searchParam: z
          .string()
          .optional()
          .describe("Optional search parameter to narrow the query"),
        offset: z.number().optional().describe("Optional result offset for pagination"),
        limit: z.number().optional().describe("Optional maximum number of results to return"),
        parentType: z
          .string()
          .optional()
          .describe("Optional parent type to scope the search results"),
      },
    },
    async ({ mediaSourceId, key, searchParam, offset, limit, parentType }) => {
      const results = await client.plexSearch(mediaSourceId, key, {
        searchParam,
        offset,
        limit,
        parentType,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_filters",
    {
      description:
        "Get the available filter options for a Plex library, exposing the filterable attributes (such as genre, year, or actor) used to build a filtered Plex search. Plex is one of the media source types Tunarr supports; use the returned filter keys with plex_search. Get the media source ID via list_media_sources and the library key via plex_libraries or plex_collections. This is a read-only lookup and returns the filter options as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        key: z.string().describe("Required Plex library key (from plex_libraries or plex_collections)"),
      },
    },
    async ({ mediaSourceId, key }) => {
      const filters = await client.plexFilters(mediaSourceId, key);
      return {
        content: [{ type: "text", text: JSON.stringify(filters, null, 2) }],
      };
    },
  );

  server.registerTool(
    "plex_tags",
    {
      description:
        "Get the available tag options for a Plex library, exposing the tag attributes (such as content rating or mood) used to build a filtered Plex search. Plex is one of the media source types Tunarr supports; use the returned tag keys with plex_search. Get the media source ID via list_media_sources and the library key and item key via plex_libraries or plex_collections. This is a read-only lookup and returns the tag options as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryKey: z.string().describe("Required Plex library key (from plex_libraries or plex_collections)"),
        itemKey: z
          .string()
          .describe("Required Plex item key (from plex_libraries or plex_collections)"),
      },
    },
    async ({ mediaSourceId, libraryKey, itemKey }) => {
      const tags = await client.plexTags(mediaSourceId, libraryKey, itemKey);
      return {
        content: [{ type: "text", text: JSON.stringify(tags, null, 2) }],
      };
    },
  );

  server.registerTool(
    "jellyfin_library_genres",
    {
      description:
        "List the genres available within a Jellyfin library, exposing them for browsing and filtering. Jellyfin is one of the media source types Tunarr supports; use this to obtain genre identifiers for browsing the library. Get the media source ID via list_media_sources and the library ID via jellyfin_user_libraries or list_source_libraries. This is a read-only lookup and returns the array of genre objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The Jellyfin library ID (get available IDs via jellyfin_user_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const genres = await client.jellyfinLibraryGenres(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(genres, null, 2) }],
      };
    },
  );

  server.registerTool(
    "jellyfin_library_items",
    {
      description:
        "List the items contained in a specific Jellyfin library, exposing them for browsing. Jellyfin is one of the media source types Tunarr supports; use this to obtain Jellyfin item IDs for get_media_library or list_library_programs. Get the media source ID via list_media_sources and the library ID via jellyfin_user_libraries or list_source_libraries. This is a read-only lookup and returns the array of library items as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The Jellyfin library ID (get available IDs via jellyfin_user_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const items = await client.jellyfinLibraryItems(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.registerTool(
    "jellyfin_user_libraries",
    {
      description:
        "List the libraries available to the user attached to a Jellyfin media source, exposing them for scanning and browsing. Jellyfin is one of the media source types Tunarr supports; use this to obtain Jellyfin library IDs for jellyfin_library_items, jellyfin_library_genres, or list_library_programs. Get the media source ID via list_media_sources. This is a read-only lookup and returns the array of user library objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const libraries = await client.jellyfinUserLibraries(id);
      return {
        content: [{ type: "text", text: JSON.stringify(libraries, null, 2) }],
      };
    },
  );

  server.registerTool(
    "emby_library_items",
    {
      description:
        "List the items contained in a specific Emby library, exposing them for browsing. Emby is one of the media source types Tunarr supports; use this to obtain Emby item IDs for get_media_library or list_library_programs. Get the media source ID via list_media_sources and the library ID via emby_user_libraries or list_source_libraries. This is a read-only lookup and returns the array of library items as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        mediaSourceId: z
          .string()
          .describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The Emby library ID (get available IDs via emby_user_libraries)"),
      },
    },
    async ({ mediaSourceId, libraryId }) => {
      const items = await client.embyLibraryItems(mediaSourceId, libraryId);
      return {
        content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.registerTool(
    "emby_user_libraries",
    {
      description:
        "List the libraries available to the user attached to an Emby media source, exposing them for scanning and browsing. Emby is one of the media source types Tunarr supports; use this to obtain Emby library IDs for emby_library_items or list_library_programs. Get the media source ID via list_media_sources. This is a read-only lookup and returns the array of user library objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
      },
    },
    async ({ id }) => {
      const libraries = await client.embyUserLibraries(id);
      return {
        content: [{ type: "text", text: JSON.stringify(libraries, null, 2) }],
      };
    },
  );

  server.registerTool(
    "add_library_to_source",
    {
      description:
        "Add a library to a media source so that Tunarr indexes it, changing which libraries Tunarr reads from that source. This is a mutating operation (an HTTP PUT) that updates the source's library configuration; get the media source ID via list_media_sources and the library ID via list_source_libraries or the appropriate plex/jellyfin/emby tool. This returns the updated media source object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The media source ID (get available IDs via list_media_sources)"),
        libraryId: z
          .string()
          .describe("The library ID to add to the source (get available IDs via list_source_libraries)"),
        enabled: z.boolean().optional().describe("Whether the library should be enabled on the source"),
        body: add_library_to_sourceBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        add_library_to_sourceBodySchema,
        (f) => ({ enabled: f.enabled as boolean | undefined }),
      );
      const source = await client.addLibraryToSource(args.id, args.libraryId, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(source, null, 2) }],
      };
    },
  );
}
