import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TunarrClient } from "../client.js";
import type { Channel } from "../types/tunarr.js";
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
  server.registerTool(
    "create_channel_from_show",
    {
      description:
        "Create a TV channel backed by a show and attach the show's first season's episodes as the channel's lineup in a single call. This is the fastest way to stand up a new channel — pass a show ID (Tunarr UUID, external id, or title) and a channel name, and the show is resolved, the channel is created, and the lineup is attached. Returns the created channel, the resolved show, and the new channel id.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelName: z.string().describe("The name of the channel to create"),
        showId: z.string().describe("Show ID, UUID, external id, or title"),
        channelId: z.string().optional().describe("Channel UUID to create; a random id is generated when omitted"),
        channelNumber: z.number().optional().describe("Channel number in the guide (defaults to 0)"),
        transcodeConfigId: z.string().optional().describe("Transcode config to use; defaults to the first available config"),
        lineUp: z
          .enum(["ordered", "chronological", "random", "next"])
          .optional()
          .describe("Order in which the show's episodes are placed in the lineup (default: ordered)"),
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
        "Attach a show to an existing channel by resolving the show and adding its first season's episodes to the channel's lineup. Use this to extend a channel's lineup with a new show without disturbing existing entries. Pass the target channel id and a show ID (Tunarr UUID, external id, or title); the show is resolved and its lineup is appended. Returns the attached lineup result and the resolved show.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelId: z.string().describe("The channel id to attach the show to"),
        showId: z.string().describe("Show ID, UUID, external id, or title"),
        lineUp: z
          .enum(["ordered", "chronological", "random", "next"])
          .optional()
          .describe("Order in which the show's episodes are placed in the lineup (default: ordered)"),
      },
    },
    async (args) => {
      const result = await client.addShowToChannel(
        args.channelId,
        args.showId,
        { lineUp: args.lineUp },
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

  server.registerTool(
    "get_episode_list",
    {
      description:
        "List the episodes that belong to a show. Pass a show ID (Tunarr UUID, external id, or title) to get every season and its episodes, or also pass a season id to get just that season's episodes. The show is validated before the list is returned. Returns the episode data as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        showId: z.string().describe("Show ID, UUID, external id, or title"),
        seasonId: z.string().optional().describe("Season id to limit the results to a single season"),
      },
    },
    async (args) => {
      const episodes = await client.getEpisodeList(args.showId, args.seasonId);
      return {
        content: [{ type: "text", text: JSON.stringify(episodes, null, 2) }],
      };
    },
  );
}
