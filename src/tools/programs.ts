import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TerminalProgram } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";
import {
  batch_lookup_program_groupingsBodySchema,
  search_programsBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerProgramsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "lookup_program",
    {
      description:
        "Look up a program by its Tunarr-internal UUID and return full details including title, artwork, media info, and external identifiers. Programs come from the configured media sources (Plex, Jellyfin, Emby, local) and are the building blocks of channel lineups, custom shows, and filler lists. This is a read-only lookup that returns the full program object as JSON; use lookup_by_external_id instead when you only have an IMDb or TMDb ID.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The program's internal Tunarr UUID"),
      },
    },
    async ({ id }) => {
      const program = await client.listPrograms(id);
      return {
        content: [{ type: "text", text: JSON.stringify(program, null, 2) }],
      };
    },
  );

  server.registerTool(
    "lookup_by_external_id",
    {
      description:
        "Look up a program by its external ID, such as an IMDb ID ('tt0133093') or a TMDb ID ('tmdb:123'), and get the corresponding Tunarr-internal program. Use this when you know a well-known external identifier and need the Tunarr UUID that channel, custom show, and filler list tools expect. This is a read-only lookup that returns the program object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        externalId: z
          .string()
          .describe("External identifier such as 'tt0133093' (IMDb) or 'tmdb:123' (TMDb)"),
      },
    },
    async ({ externalId }) => {
      const program = await client.lookupProgramming(externalId);
      return {
        content: [{ type: "text", text: JSON.stringify(program, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_children",
    {
      description:
        "Get the child programs of a given program, for example the episodes within a TV show season. Use this to expand a parent program into the individual programs that lineups, custom shows, and filler lists can reference. This is a read-only lookup; get the parent's Tunarr UUID via lookup_program or lookup_by_external_id, and it returns an array of program objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The parent program's Tunarr UUID (get it via lookup_program or lookup_by_external_id)"),
      },
    },
    async ({ id }) => {
      const children = await client.getProgramChildren(id);
      return {
        content: [{ type: "text", text: JSON.stringify(children, null, 2) }],
      };
    },
  );

  server.registerTool(
    "batch_lookup_programs",
    {
      description:
        "Look up multiple programs at once by their external IDs, such as IMDb IDs ('tt0133093') or TMDb IDs ('tmdb:123'). Use this instead of repeated lookup_by_external_id calls when you have several identifiers to resolve. This is a read-only lookup that returns an array of program results as JSON, one per external ID.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        externalIds: z
          .array(z.string())
          .describe("Array of external IDs to look up (e.g. ['tt0133093', 'tmdb:123'])"),
      },
    },
    async ({ externalIds }) => {
      const results = await client.batchLookupPrograms(externalIds);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_show_details",
    {
      description:
        "Get the complete details of a single TV show by its ID or UUID, including its title, external identifiers, seasons, and metadata. Use this when you need the full details of one show rather than a program summary; obtain show IDs via lookup_program, list_programs, get_channel_programs, or get_program_children. This is a read-only lookup that returns the full show object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The show ID or UUID (get available IDs via lookup_program, list_programs, or get_channel_programs)"),
      },
    },
    async ({ id }) => {
      const show = await client.getShowDetails(id);
      return {
        content: [{ type: "text", text: JSON.stringify(show, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_season_details",
    {
      description:
        "Get the complete details of a single TV show season by its ID or UUID, including its number, title, and episodes. Use this when you need the full details of one season rather than the whole show; obtain season IDs from get_show_details or list_show_seasons. This is a read-only lookup that returns the full season object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The season ID or UUID (get available IDs via get_show_details or list_show_seasons)"),
      },
    },
    async ({ id }) => {
      const season = await client.getSeasonDetails(id);
      return {
        content: [{ type: "text", text: JSON.stringify(season, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_show_seasons",
    {
      description:
        "List all seasons belonging to a TV show, including their IDs, numbers, and titles. Use this to expand a show into the seasons it contains before fetching individual season details; obtain show IDs via get_show_details or get_program_children. This is a read-only lookup that returns the array of season objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The show ID or UUID (get available IDs via get_show_details or get_program_children)"),
      },
    },
    async ({ id }) => {
      const seasons = await client.listShowSeasons(id);
      return {
        content: [{ type: "text", text: JSON.stringify(seasons, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_grouping",
    {
      description:
        "Get a single program grouping by its ID or UUID. Program groupings organize programs into collections such as custom shows, playlists, and other groupings used in Tunarr lineups. Obtain a grouping ID via lookup_program, list_programs, or get_channel_programs. This is a read-only lookup that returns the full program grouping object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The program grouping ID or UUID (get available IDs via lookup_program or get_channel_programs)"),
      },
    },
    async ({ id }) => {
      const grouping = await client.getProgramGrouping(id);
      return {
        content: [{ type: "text", text: JSON.stringify(grouping, null, 2) }],
      };
    },
  );

  server.registerTool(
    "batch_lookup_program_groupings",
    {
      description:
        "Look up multiple program groupings at once by their IDs or external ID references, in a single call. Use this instead of repeated get_program_grouping calls when you have several grouping identifiers to resolve. This is a read-only lookup with read-only semantics (it performs a POST lookup but does not modify anything) and returns the array of grouping results as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        externalIds: z
          .array(z.string())
          .optional()
          .describe("Array of grouping IDs or external ID references to look up"),
        body: batch_lookup_program_groupingsBodySchema
          .optional()
          .describe("Advanced: raw batch lookup DTO for unexposed fields (e.g. externalIds)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        batch_lookup_program_groupingsBodySchema,
        (f) => ({ externalIds: f.externalIds as string[] | undefined }),
      );
      const results = await client.batchLookupProgramGroupings(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_facets",
    {
      description:
        "Get the program facets (filterable attributes such as genre, actor, year, or custom dimensions) exposed by the Tunarr API for a given facet name or path. Use this to discover the available facet values before building a filtered program search; facet names are exposed by the Tunarr API itself. This is a read-only lookup that returns the facet values as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        facetName: z.string().describe("Facet name/path exposed by the Tunarr API"),
      },
    },
    async ({ facetName }) => {
      const facets = await client.getProgramFacets(facetName);
      return {
        content: [{ type: "text", text: JSON.stringify(facets, null, 2) }],
      };
    },
  );

  server.registerTool(
    "search_programs",
    {
      description:
        "Search programs in Tunarr using a free-text query, or restrict by media source or library. Use this to find programs by title (e.g. query='Voyager'); for advanced facet filters or sorting, pass the raw DTO via body. This is a read-only lookup with read-only semantics (it performs a POST search but does not modify anything) and returns the search results as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe("Free-text search query, e.g. 'Voyager'"),
        mediaSourceId: z
          .string()
          .optional()
          .describe("Only search within this media source (id from list_media_sources)"),
        libraryId: z.string().optional().describe("Only search within this library"),
        page: z.number().int().min(0).optional().describe("0-based page index"),
        limit: z.number().int().min(1).optional().describe("Maximum number of results per page"),
        expandParents: z
          .boolean()
          .optional()
          .describe("Expand parent programs to include their child programs"),
        body: search_programsBodySchema
          .optional()
          .describe("Advanced: raw search DTO for filter/sort/restrictSearchTo and other unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        search_programsBodySchema,
        (f) => ({
          query: f.query !== undefined ? { query: f.query as string } : undefined,
          mediaSourceId: f.mediaSourceId as string | undefined,
          libraryId: f.libraryId as string | undefined,
          page: f.page as number | undefined,
          limit: f.limit as number | undefined,
          expandParents: f.expandParents as boolean | undefined,
        }),
      );
      const results = await client.searchPrograms(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_artwork",
    {
      description:
        "Get the artwork for a program (poster, thumbnail, logo, fanart, watermark, banner, or landscape) by its ID and the requested artwork type. Use this when you need the actual artwork assets or URLs for a program; obtain the program ID via lookup_program, list_programs, or get_channel_programs. This is a read-only lookup that returns the requested artwork as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The program ID or UUID (get available IDs via lookup_program, list_programs, or get_channel_programs)"),
        artworkType: z.enum(["poster","thumbnail","logo","fanart","watermark","banner","landscape"]).describe("The type of artwork to retrieve"),
      },
    },
    async ({ id, artworkType }) => {
      const artwork = await client.getProgramArtwork(id, artworkType);
      return {
        content: [{ type: "text", text: JSON.stringify(artwork, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_descendants",
    {
      description:
        "Get the descendant programs of a given program, i.e. the full transitive set of child programs nested beneath it (for example every episode beneath a show). Use this to fully expand a parent program into all of the individual programs it contains; obtain the parent ID via lookup_program or get_program_children. This is a read-only lookup that returns the array of descendant programs as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The parent program's Tunarr UUID (get it via lookup_program or get_program_children)"),
      },
    },
    async ({ id }) => {
      const descendants = await client.getProgramDescendants(id);
      return {
        content: [{ type: "text", text: JSON.stringify(descendants, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_external_link",
    {
      description:
        "Get the external links (such as IMDb or TMDb) associated with a program by its ID. Use this when you need the well-known external page URLs for a program rather than just its identifiers; obtain the program ID via lookup_program or get_channel_programs. This is a read-only lookup that returns the external link(s) as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The program ID or UUID (get available IDs via lookup_program or get_channel_programs)"),
      },
    },
    async ({ id }) => {
      const links = await client.getProgramExternalLink(id);
      return {
        content: [{ type: "text", text: JSON.stringify(links, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_program_stream_details",
    {
      description:
        "Get the stream details for a program, including the playable stream URLs, media sources, and any associated credits. Use this when you need to resolve how a program can be played or want the credit references tied to that stream; obtain the program ID via lookup_program or get_channel_programs. This is a read-only lookup that returns the stream details object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The program ID or UUID (get available IDs via lookup_program or get_channel_programs)"),
      },
    },
    async ({ id }) => {
      const streamDetails = await client.getProgramStreamDetails(id);
      return {
        content: [{ type: "text", text: JSON.stringify(streamDetails, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_credit",
    {
      description:
        "Get the full details of a single credit (a person such as an actor, director, or writer) by its credit ID. Use this when you need the complete profile of a person tied to a program; obtain credit IDs from get_program_stream_details or from credit references in program details. This is a read-only lookup that returns the full credit object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The credit (person) ID (get available IDs via get_program_stream_details or program credit references)"),
      },
    },
    async ({ id }) => {
      const credit = await client.getCredit(id);
      return {
        content: [{ type: "text", text: JSON.stringify(credit, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_credit_artwork",
    {
      description:
        "Get the artwork for a credit (a person such as an actor or director) by its ID and the requested artwork type. Use this when you need the portrait or other assets for a person; obtain the credit ID from get_program_stream_details or program credit references. This is a read-only lookup that returns the requested artwork as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The credit (person) ID (get available IDs via get_program_stream_details or program credit references)"),
        artworkType: z.enum(["poster","thumbnail","logo","fanart","watermark","banner","landscape"]).describe("The type of artwork to retrieve"),
      },
    },
    async ({ id, artworkType }) => {
      const artwork = await client.getCreditArtwork(id, artworkType);
      return {
        content: [{ type: "text", text: JSON.stringify(artwork, null, 2) }],
      };
    },
  );
}
