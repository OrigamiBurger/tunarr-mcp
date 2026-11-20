import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GuideStatus } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";

export function registerGuideTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "get_guide_status",
    {
      description:
        "Get the current status of the EPG/XMLTV guide system, including the last refresh time, refresh progress, and channel coverage. The guide is generated from channel schedules, so use this to check whether guide data is up to date after lineup changes. This is a read-only lookup and returns the guide status object as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const status = await client.getGuideStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_guide_channels",
    {
      description:
        "List all channels for which guide/EPG data is available, showing which channels are being populated with program data. The guide is generated from channel schedules, so use this to confirm a channel is covered before inspecting its program data. This is a read-only lookup and returns the array of guide channel objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const channels = await client.getGuideChannels();
      return {
        content: [{ type: "text", text: JSON.stringify(channels, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_guide_channel",
    {
      description:
        "Get the detailed guide/EPG data for a specific channel, including its scheduled programs and time slots. Use this to see what a channel will air according to the generated guide; obtain channel IDs via list_channels or list_guide_channels. This is a read-only lookup and returns the guide channel object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get guide data for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const guideData = await client.getGuideChannel(id);
      return {
        content: [{ type: "text", text: JSON.stringify(guideData, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_xmltv_last_refresh",
    {
      description:
        "Get the timestamp and status of the last XMLTV guide refresh in Tunarr. The guide is generated from channel schedules, so use this to confirm whether the XMLTV/EPG source has been refreshed recently after lineup changes. This is a read-only lookup and returns the last refresh info as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const refresh = await client.getXmltvLastRefresh();
      return {
        content: [{ type: "text", text: JSON.stringify(refresh, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_guide_debug",
    {
      description:
        "Get debug and diagnostic information about the Tunarr guide/EPG generation process, useful for troubleshooting why guide data is missing or stale. Use this when inspecting guide problems after running get_guide_status. This is a read-only lookup and returns the guide debug/diagnostic info as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const debug = await client.getGuideDebug();
      return {
        content: [{ type: "text", text: JSON.stringify(debug, null, 2) }],
      };
    },
  );
}
