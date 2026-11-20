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
        "List all TV channels configured in Tunarr, a self-hosted IPTV server that turns media libraries into linear TV channels. Channels are the primary entity in Tunarr, so start here whenever you need channel IDs or UUIDs for get_channel, update_channel, delete_channel, get_channel_schedule, guide, or session tools. This is a read-only lookup and returns the full array of channel objects as JSON.",
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
        "Get the complete configuration of a single channel by its ID or UUID, including its number, group title, and related settings. Use this when you need the full details of one channel rather than the summary list; obtain channel IDs via list_channels. This is a read-only lookup and returns the full channel object as JSON.",
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
        "Create a new TV channel in Tunarr, the primary entity that plays a linear schedule of content. Provide name, type (e.g. 'smart' or 'time'), and optional configuration such as groupTitle or guideFlexTitle; the channel's lineup is later built from programs, custom shows, filler lists, or smart collections. This mutates Tunarr by creating a new channel and returns the newly created channel object as JSON.",
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
        "Update an existing channel's configuration, such as its name, number, or display options, without recreating it. Get the channel ID via list_channels and only include the fields you want to change. This mutates the channel in place and returns the updated channel object as JSON. If the change affects the lineup, a guide refresh task may be needed afterwards (see list_tasks and run_task).",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The channel ID or UUID to update (get available IDs via list_channels)"),
        name: z.string().optional().describe("The new channel name"),
        number: z.number().optional().describe("The channel number"),
        groupTitle: z.string().optional().describe("The channel group title"),
        guideFlexTitle: z.string().optional().describe("The guide flex title"),
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
        "Permanently delete a channel by its ID or UUID. This is a destructive, irreversible operation: the channel and its schedule are removed from Tunarr, so verify the correct ID with list_channels before calling. Returns a JSON confirmation with success and a message.",
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
        "Get the schedule configuration for a specific channel, including its time slots, flex settings, and other scheduling parameters that make up its lineup. Use this when inspecting or debugging how a channel is programmed; obtain channel IDs via list_channels. This is a read-only lookup and returns the schedule object as JSON.",
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
        "Get all programs that make up a channel's lineup source contents, i.e. every program item the channel draws from when playing. Use this when you need to see what content a channel contains before modifying its programming or building schedules; obtain channel IDs via list_channels. This is a read-only lookup and returns the array of channel programs as JSON.",
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
        "Get the compiled lineup of a channel: the ordered sequence of program slots the channel plays, after schedules, flex time, and fillers have been resolved. Use this to inspect the actual playback order rather than the raw programming source; obtain channel IDs via list_channels. This is a read-only lookup and returns the compiled lineup as JSON.",
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
        "Get what is playing on a channel right now, including the current program and its position in the lineup. Use this to check live channel state, for example to answer 'what's on channel 1 at this moment'; obtain channel IDs via list_channels. This is a read-only lookup and returns the now-playing status object as JSON.",
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
        "Get the full programming/schedule configuration of a channel, including its program sources, schedule slots, time slots, and ordering settings. Use this when you need the complete picture of how a channel is programmed before making changes with add_program_to_channel, add_schedule_slot, or clear_channel_schedule; obtain channel IDs via list_channels. This is a read-only lookup and returns the full programming configuration as JSON.",
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
        "Get the fallback program list configured for a channel, which plays whenever the lineup has no scheduled content (for example during flex gaps). Use this to see what a channel will air when nothing else is scheduled; obtain channel IDs via list_channels. This is a read-only lookup and returns the fallback program list as JSON.",
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
        "Get native playback information for a channel, describing how Tunarr serves the channel's stream directly to players. Use this when debugging playback or integrating native playback clients; obtain channel IDs via list_channels. This is a read-only lookup and returns the native playback info as JSON.",
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
        "List the compiled lineups across all channels configured in Tunarr, in one call. Use this when you want an overview of what every channel currently plays instead of calling get_channel_lineup per channel; obtain per-channel details via get_channel_lineup afterwards. This is a read-only lookup and returns the array of channel lineups as JSON.",
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
        "Add programs to a channel's programming, extending the content the channel can play. Use this after finding programs via lookup_program / list_programs (or via get_channel_programs to see what the channel already has); provide the programs or tokens in the request body per the Tunarr programming API. This mutates the channel's programming and returns the updated programming result as JSON.",
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
        "Add a schedule slot to a channel, defining one entry of its programming schedule. Use this when building or extending a channel's schedule config; obtain channel IDs via list_channels and inspect the current schedule with get_channel_programming or get_channel_schedule. This mutates the channel's schedule and returns the updated schedule as JSON.",
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
        "Add a time-based schedule slot to a channel, placing programming at a specific time of day. Use this when you want a channel to air content at fixed times; obtain channel IDs via list_channels and inspect the current time slots with get_channel_programming or get_channel_schedule. This mutates the channel's schedule and returns the updated schedule as JSON.",
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
        "Add filler lists to many channels at once. Fillers play between or over scheduled content (such as pre-roll commercials or interstitials); use this to attach the same filler collections to several channels instead of updating each one. This mutates the affected channels and returns the bulk operation result as JSON.",
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
        "Permanently clear a channel's entire schedule, removing all of its schedule slots and time slots. This is a destructive, irreversible operation: the removed schedule configuration cannot be recovered, so verify the correct channel ID with list_channels before calling. Returns a JSON confirmation with success and a message.",
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
