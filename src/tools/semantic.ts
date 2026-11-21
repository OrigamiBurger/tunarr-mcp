import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TunarrClient } from "../client.js";
import type { Channel, TranscodeConfig } from "../types/tunarr.js";
import { z } from "zod";

/**
 * Semantic, task-oriented tools.
 *
 * These wrap the raw endpoint-shaped tools in goal-oriented operations that
 * hide the Tunarr DTO contract entirely. Each call resolves inputs, assembles
 * the correct request bodies, and orchestrates multiple endpoints, returning
 * only the outcome the caller cares about.
 */
export function registerSemanticTools(server: McpServer, client: TunarrClient) {
  // ── Channel creation from shows ────────────────────────────────────────

  server.registerTool(
    "create_channel_from_show",
    {
      description:
        "Create a TV channel backed by a show and attach its episodes as the channel's lineup in a single call. Pass a show ID (Tunarr UUID, external id like TMDb/IMDb, or title) and a channel name. By default adds the first season; use `includeAllSeasons` to add every season, or `seasonId` for a specific season. Returns the created channel, resolved show info, and the new channel id.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelName: z.string().describe("The name of the channel to create"),
        showId: z.string().describe("Show ID, UUID, external id (tmdb:123, tt0133093), or title — auto-resolved"),
        channelId: z.string().optional().describe("Channel UUID to create; a random id is generated when omitted"),
        channelNumber: z.number().optional().describe("Channel number in the guide (defaults to 0)"),
        groupTitle: z.string().optional().describe("Group title for organizing channels in the guide (defaults to channelName)"),
        guideFlexTitle: z.string().optional().describe("Guide flex title shown during flex time gaps"),
        transcodeConfigId: z.string().optional().describe("Transcode config to use; defaults to the first available config"),
        lineUp: z
          .enum(["ordered", "chronological", "random", "next"])
          .optional()
          .describe("Order in which episodes are placed in the lineup (default: ordered)"),
        seasonId: z.string().optional().describe("Specific season UUID to add; mutually exclusive with includeAllSeasons"),
        includeAllSeasons: z.boolean().optional().describe("Add every season of the show (overrides seasonId)"),
      },
    },
    async (args) => {
      const result = await client.createChannelFromShow(
        args.channelId ?? "",
        args.channelName,
        args.showId,
        {
          channelNumber: args.channelNumber,
          transcodeConfigId: args.transcodeConfigId,
          lineUp: args.lineUp,
          seasonId: args.seasonId as string | undefined,
          includeAllSeasons: args.includeAllSeasons as boolean | undefined,
          groupTitle: args.groupTitle as string | undefined,
          guideFlexTitle: args.guideFlexTitle as string | undefined,
        },
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                createdChannel: result.createdChannel as Channel,
                resolvedShow: result.resolvedShow,
                channelId: result.channelId,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_show_to_channel",
    {
      description:
        "Attach a show's episodes to an existing channel without disturbing its current lineup. By default adds the first season; use `includeAllSeasons` to add every season, or `seasonId` for a specific season. Pass the target channel id and a show ID (Tunarr UUID, external id, or title). Returns the attached lineup result and resolved show info.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelId: z.string().describe("The channel id to attach the show to"),
        showId: z.string().describe("Show ID, UUID, external id (tmdb:123, tt0133093), or title — auto-resolved"),
        lineUp: z
          .enum(["ordered", "chronological", "random", "next"])
          .optional()
          .describe("Order in which episodes are placed in the lineup (default: ordered)"),
        seasonId: z.string().optional().describe("Specific season UUID to add; mutually exclusive with includeAllSeasons"),
        includeAllSeasons: z.boolean().optional().describe("Add every season of the show (overrides seasonId)"),
      },
    },
    async (args) => {
      const result = await client.addShowToChannel(
        args.channelId,
        args.showId,
        {
          lineUp: args.lineUp,
          seasonId: args.seasonId as string | undefined,
          includeAllSeasons: args.includeAllSeasons as boolean | undefined,
        },
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                attached: result.attached,
                resolvedShow: result.resolvedShow,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Season / episode discovery ─────────────────────────────────────────

  server.registerTool(
    "get_episode_list",
    {
      description:
        "List the episodes that belong to a show. When called without seasonId, returns every season and its episodes. Pass a season id to get just that season's episodes. Returns a flat array of episode objects with title, episode number, duration, and UUID.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        showId: z.string().describe("Show ID, UUID, external id, or title"),
        seasonId: z.string().optional().describe("Season id to limit the results to a single season"),
      },
    },
    async (args) => {
      const result = await client.getEpisodeList(args.showId, args.seasonId);
      // Flatten per-season data into a single array of episodes
      let episodes: unknown[];
      if (Array.isArray(result)) {
        // Each element is either a season or an episode
        const flat: unknown[] = [];
        for (const item of result) {
          const obj = item as Record<string, unknown>;
          // If it has an "episodes" field, extract them
          if (Array.isArray(obj.episodes)) {
            flat.push(...obj.episodes);
          } else if (obj.uuid && obj.type === "episode") {
            flat.push(item);
          }
        }
        episodes = flat;
      } else {
        episodes = Array.isArray(result) ? result : [];
      }
      return {
        content: [{ type: "text", text: JSON.stringify(episodes, null, 2) }],
      };
    },
  );

  // ── Show discovery ─────────────────────────────────────────────────────

  server.registerTool(
    "search_shows",
    {
      description:
        "Search for TV shows by title or keyword. Unlike the generic search_programs tool, this is optimized for show discovery and returns only show-type results with their titles, IDs, and external identifiers (TMDb, IMDb, TVDb). Pass a query string to find shows; use mediaSourceId to restrict to a specific library.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().describe("Search query — a show title or keyword, e.g. 'Addams Family'"),
        mediaSourceId: z.string().optional().describe("Only search within this media source (get IDs via list_media_sources)"),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum results to return (default: 10)"),
      },
    },
    async (args) => {
      const results = await client.searchPrograms({
        query: { query: args.query },
        mediaSourceId: args.mediaSourceId,
        page: 0,
        limit: args.limit ?? 10,
        expandParents: true,
      });
      // Filter to only show-type results and extract key fields
      const shows = (results as Record<string, unknown>[] | undefined)
        ?.filter((r) => (r.type as string) === "show")
        .map((r) => ({
          id: (r.uuid as string) ?? "",
          title: (r.title as string) ?? "",
          type: (r.type as string) ?? "",
          year: (r.year as number) ?? 0,
          externalId: (r.externalId as string) ?? "",
        })) ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(shows, null, 2) }],
      };
    },
  );

  // ── Transcode config visibility ────────────────────────────────────────

  server.registerTool(
    "list_transcode_configs",
    {
      description:
        "List all available transcode configurations that can be used when creating channels. Each config defines encoding settings (resolution, hardware acceleration, thread count). Use this to choose the right config for your channel instead of letting the system pick the first one silently.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const configs = await client.getTranscodeConfigs();
      // Extract key fields for readability
      const summary = (Array.isArray(configs) ? configs : [])
        .map((c) => {
          const resolution = c.resolution as string | Record<string, unknown> | undefined;
          let resolutionStr = "";
          if (typeof resolution === "string") {
            resolutionStr = resolution;
          } else if (resolution && typeof resolution === "object") {
            const r = resolution as Record<string, unknown>;
            resolutionStr = `${r.widthPx ?? "?"}x${r.heightPx ?? "?"}`;
          }
          return {
            id: (c.id as string) ?? "",
            name: (c.name as string) ?? "",
            resolution: resolutionStr,
            threadCount: (c.threadCount as number) ?? 0,
            hardwareAccelerationMode: (c.hardwareAccelerationMode as string) ?? "",
          };
        })
        .filter((c) => c.id);
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    },
  );
}
