import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionsMap } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";

export function registerSessionsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_sessions",
    {
      description:
        "List all active streaming sessions across all channels, showing who is currently watching and their connection details. Use this to get an overview of viewers or to find the channel whose sessions you want to inspect or terminate. This is a read-only lookup that returns a JSON map of sessions keyed by channel ID.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sessions = await client.getSessions();
      return {
        content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_sessions",
    {
      description:
        "Get the active streaming sessions for a specific channel, showing who is watching and their connection details. Use this to check current viewers on a channel before deciding to force-stop them with delete_channel_sessions; obtain channel IDs via list_channels. This is a read-only lookup that returns the channel's sessions as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        channelId: z.string().describe("The channel ID to check for active sessions (get available IDs via list_channels)"),
      },
    },
    async ({ channelId }) => {
      const sessions = await client.getSession(channelId);
      return {
        content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_channel_sessions",
    {
      description:
        "Force-stop all active streaming sessions for a specific channel. This is a destructive operation that immediately disconnects every active viewer on that channel, so use it only to kill stuck or unwanted streams; check first with get_channel_sessions and get channel IDs via list_channels. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        channelId: z
          .string()
          .describe("The channel ID whose sessions should be terminated (get available IDs via list_channels)"),
      },
    },
    async ({ channelId }) => {
      await client.deleteSessions(channelId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `All sessions for channel ${channelId} terminated` }),
          },
        ],
      };
    },
  );
}
