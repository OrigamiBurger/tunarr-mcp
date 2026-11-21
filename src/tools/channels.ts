import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Channel } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";
import { normalizeToDto } from "./normalize.js";
import {
  add_program_to_channelBodySchema,
  add_schedule_slotBodySchema,
  add_schedule_time_slotBodySchema,
  bulk_add_fillersBodySchema,
  create_channelBodySchema,
  update_channelBodySchema,
} from "../generated/tool-schemas.js";

export function registerChannelsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_channels",
    {
      description:
        "List all TV channels configured in Tunarr. This is the first tool to call whenever you need channel IDs or UUIDs — every other channel tool requires an ID obtained from this list (or from get_channel). Call it before any read tool (get_channel, get_channel_schedule, get_channel_programming) and before any write tool (create_channel, update_channel, delete_channel, add_program_to_channel, add_schedule_slot, clear_channel_schedule, bulk_add_fillers). This is a read-only lookup and returns the full array of channel objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const channels = await client.getChannels();
      return {
        content: [{ type: "text", text: JSON.stringify(channels, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel",
    {
      description:
        "Get the complete configuration of a single channel by its ID or UUID, including its number, group title, and display settings. Call after list_channels to get a channel ID, then use this when you need the full details of one specific channel rather than the summary list. Use get_channel_programming or get_channel_schedule if you need lineup/schedule details instead. This is a read-only lookup and returns the full channel object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const channel = await client.getChannel(id);
      return {
        content: [{ type: "text", text: JSON.stringify(channel, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_channel",
    {
      description:
        "Create a new TV channel in Tunarr. This is the first step when building a channel from scratch — after calling this, you must populate the channel with content using add_program_to_channel, add_schedule_slot, or add_schedule_time_slot. Provide name, type (e.g. 'smart' or 'time'), and optional configuration such as groupTitle or guideFlexTitle in the request body. After creating a channel, obtain its ID from the response to use with subsequent tools. Returns the newly created channel object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        body: create_channelBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(args, create_channelBodySchema, () => ({}));
      const channel = await client.createChannel(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(channel, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_channel",
    {
      description:
        "Update an existing channel's configuration (name, number, group title, guide flex title) without recreating it. Get the channel ID via list_channels first, then only include the fields you want to change — omitted fields are left as-is. This does not modify the channel's lineup; use add_program_to_channel or add_schedule_slot for content changes instead. After lineup changes, a guide refresh may be needed (see list_tasks and run_task). Returns the updated channel object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID to update (get available IDs via list_channels)"),
        name: z.string().optional().describe("The new channel name"),
        number: z.number().optional().describe("The channel number"),
        groupTitle: z.string().optional().describe("The channel group title"),
        guideFlexTitle: z.string().optional().describe("The channel flex title shown during gaps"),
        body: update_channelBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_channelBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          number: f.number as number | undefined,
          groupTitle: f.groupTitle as string | undefined,
          guideFlexTitle: f.guideFlexTitle as string | undefined,
        }),
      );
      const channel = await client.updateChannel(args.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(channel, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_channel",
    {
      description:
        "Permanently delete a channel by its ID or UUID. This is a destructive, irreversible operation: the channel and all its schedule slots, time slots, and programming are removed from Tunarr. Verify the correct ID with list_channels before calling. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID to delete (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      await client.deleteChannel(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Channel ${id} deleted` }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_channel_schedule",
    {
      description:
        "Get the schedule configuration for a specific channel, including its time slots, flex settings, and scheduling parameters. Call after list_channels to get a channel ID. Use this when you need to inspect or debug how a channel's timing is configured (time slots and flex gaps). For the full picture including program sources, use get_channel_programming instead. This is a read-only lookup and returns the schedule object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        channelId: z.string().describe("The channel ID to get the schedule for (get available IDs via list_channels)"),
      },
    },
    async ({ channelId }) => {
      const schedule = await client.getChannelSchedule(channelId);
      return {
        content: [{ type: "text", text: JSON.stringify(schedule, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_programs",
    {
      description:
        "Get all programs that make up a channel's lineup source contents — i.e. every program item the channel draws from when playing. Call after list_channels to get a channel ID, then use this before modifying programming (add_program_to_channel) or building schedules to see what content is already present. For the full schedule configuration including slots and flex settings, use get_channel_programming instead. This is a read-only lookup and returns the array of channel programs as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const programs = await client.getChannelPrograms(id);
      return {
        content: [{ type: "text", text: JSON.stringify(programs, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_lineup",
    {
      description:
        "Get the compiled lineup of a channel — the actual ordered sequence of program slots the channel plays, after schedules, flex time, and fillers have been resolved. Call after list_channels to get a channel ID. Use this to inspect what the channel will actually play in practice rather than the raw programming source (use get_channel_programs for that). This is a read-only lookup and returns the compiled lineup as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const lineup = await client.getChannelLineup(id);
      return {
        content: [{ type: "text", text: JSON.stringify(lineup, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_now_playing",
    {
      description:
        "Get what is playing on a channel right now, including the current program and its position in the lineup. Call after list_channels to get a channel ID. Use this to check live channel state (e.g. 'what's on channel 1 at this moment'). For historical or configuration details, use get_channel_lineup or get_channel_programming instead. This is a read-only lookup and returns the now-playing status object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const nowPlaying = await client.getChannelNowPlaying(id);
      return {
        content: [{ type: "text", text: JSON.stringify(nowPlaying, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_programming",
    {
      description:
        "Get the full programming and schedule configuration of a channel, including program sources, schedule slots, time slots, filler lists, and ordering settings. Call after list_channels to get a channel ID. This is the tool to use before making changes with add_program_to_channel, add_schedule_slot, add_schedule_time_slot, or clear_channel_schedule — inspect the current state first to avoid overwriting existing configuration. For just program sources (without schedule details), use get_channel_programs; for just timing/slots, use get_channel_schedule. This is a read-only lookup and returns the full programming configuration as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const programming = await client.getChannelProgramming(id);
      return {
        content: [{ type: "text", text: JSON.stringify(programming, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_fallbacks",
    {
      description:
        "Get the fallback program list configured for a channel, which plays whenever the lineup has no scheduled content (for example during flex gaps). Call after list_channels to get a channel ID. Use this when you need to see what a channel will air when nothing else is scheduled — it shows the programs referenced by the channel's fallbackCollections configuration. This is a read-only lookup and returns the fallback program list as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const fallbacks = await client.getChannelFallbacks(id);
      return {
        content: [{ type: "text", text: JSON.stringify(fallbacks, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_native_playback",
    {
      description:
        "Get native playback information for a channel — how Tunarr serves the channel's stream directly to players. Call after list_channels to get a channel ID. Use this when debugging playback issues or integrating native playback clients (VLC, Kodi, etc.). For lineup/schedule content details, use get_channel_programming or get_channel_lineup instead. This is a read-only lookup and returns the native playback info as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const nativePlayback = await client.getChannelNativePlayback(id);
      return {
        content: [{ type: "text", text: JSON.stringify(nativePlayback, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_channel_lineups",
    {
      description:
        "List the compiled lineups across all channels in one call. Call after list_channels to get an overview of what every channel currently plays without having to call get_channel_lineup per channel. Use this for a quick survey; for per-channel details, call get_channel_lineup with specific IDs obtained from list_channels. This is a read-only lookup and returns the array of channel lineups as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const lineups = await client.listChannelLineups();
      return {
        content: [{ type: "text", text: JSON.stringify(lineups, null, 2) }],
      };
    },
  );

  server.registerTool(
    "add_program_to_channel",
    {
      description:
        "Add programs (shows, seasons, or episodes) to a channel's programming — this defines the source content the channel draws from. Use this after creating a channel (create_channel) or as an extension step for existing channels. Before calling, obtain the channel ID via list_channels and inspect existing content with get_channel_programs. Provide program IDs or tokens in the request body per the Tunarr programming API. After adding programs, verify the result with get_channel_programming or add schedule entries (add_schedule_slot, add_schedule_time_slot) to control how/when they play. Returns the updated programming result as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID to add programs to (get available IDs via list_channels)"),
        body: add_program_to_channelBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(args, add_program_to_channelBodySchema, () => ({}));
      const result = await client.addProgramToChannel(args.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "add_schedule_slot",
    {
      description:
        "Add a schedule slot to a channel — this defines ONE entry in the channel's programming schedule. Use this for advanced scheduling: random lineups with fillers, mid-roll breaks, padding/flex behavior, weighted ordering, and iteration groups. Call after creating a channel (create_channel) or adding programs (add_program_to_channel), and inspect the current state first with get_channel_programming. Obtain the channel ID via list_channels. If you just want to append a show linearly without complex scheduling, use add_show_to_channel (semantic tool) instead — it handles add_program_to_channel internally. Returns the updated schedule as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelId: z.string().describe("The channel ID or UUID to add the slot to (get available IDs via list_channels)"),
        timeZoneOffset: z.number().optional().describe("Timezone offset in minutes to apply to the schedule"),
        randomDistribution: z.enum(["uniform", "weighted", "none"]).optional().describe("Distribution mode for random scheduling"),
        periodMs: z.number().optional().describe("The schedule period in milliseconds"),
        lockWeights: z.boolean().optional().describe("Whether to lock schedule slot weights"),
        body: add_schedule_slotBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        add_schedule_slotBodySchema,
        (f) => ({
          timeZoneOffset: f.timeZoneOffset as number | undefined,
          randomDistribution: f.randomDistribution as string | undefined,
          periodMs: f.periodMs as number | undefined,
          lockWeights: f.lockWeights as boolean | undefined,
        }),
      );
      const result = await client.addScheduleSlot(args.channelId, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "add_schedule_time_slot",
    {
      description:
        "Add a time-based schedule slot to a channel — this places programming at a specific time of day (e.g. 'air The Office every weekday at 9 AM'). Call after creating a channel (create_channel) or adding programs (add_program_to_channel), and inspect the current state first with get_channel_programming or get_channel_schedule. Obtain the channel ID via list_channels. Use this when you want fixed-air-time scheduling rather than continuous rotation. Returns the updated schedule as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelId: z.string().describe("The channel ID or UUID to add the time slot to (get available IDs via list_channels)"),
        timeZoneOffset: z.number().optional().describe("Timezone offset in minutes to apply to the schedule"),
        startTomorrow: z.boolean().optional().describe("Whether the scheduled content starts tomorrow instead of today"),
        body: add_schedule_time_slotBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        add_schedule_time_slotBodySchema,
        (f) => ({
          timeZoneOffset: f.timeZoneOffset as number | undefined,
          startTomorrow: f.startTomorrow as boolean | undefined,
        }),
      );
      const result = await client.addScheduleTimeSlot(args.channelId, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "bulk_add_fillers",
    {
      description:
        "Add filler lists to multiple channels at once. Fillers play between or over scheduled content (pre-roll commercials, interstitials, etc.). Call after list_channels to get channel IDs and after inspecting existing fillers with get_channel_programming. Use this when the same filler collections should be applied to several channels instead of updating each one individually. After adding fillers, verify with get_channel_programming or get_channel_fallbacks. Returns the bulk operation result as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        channelIds: z.array(z.string()).optional().describe("Channel IDs or UUIDs to attach the fillers to (obtainable via list_channels)"),
        mode: z.enum(["add", "replace"]).optional().describe("Whether to add fillers to or replace the channels' existing fillers"),
        body: bulk_add_fillersBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        bulk_add_fillersBodySchema,
        (f) => ({
          channelIds: f.channelIds as string[] | undefined,
          mode: f.mode as string | undefined,
        }),
      );
      const result = await client.bulkAddFillers(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "clear_channel_schedule",
    {
      description:
        "Permanently clear a channel's entire schedule — removes all schedule slots and time slots. This is a destructive, irreversible operation that does NOT remove programming (programs added via add_program_to_channel remain). After clearing, you must re-add scheduling entries with add_schedule_slot or add_schedule_time_slot to define how/when content plays. Verify the correct channel ID with list_channels before calling. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID whose schedule will be cleared (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      await client.clearChannelSchedule(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Channel ${id} schedule cleared` }),
          },
        ],
      };
    },
  );
}
