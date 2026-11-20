import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";

export function registerStreamingTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "get_m3u_playlist",
    {
      description:
        "Get the M3U playlist covering all Tunarr channels as raw M3U text. Tunarr is a self-hosted IPTV server, and this playlist can be loaded into media players like VLC or Kodi to watch the channels. This is a read-only operation that mutates nothing and returns the M3U playlist text; per-channel stream URLs are available via get_channel_stream_url.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const playlist = await client.getM3uPlaylist();
      return {
        content: [{ type: "text", text: playlist }],
      };
    },
  );

  server.registerTool(
    "get_xmltv_playlist",
    {
      description:
        "Get the XMLTV guide data for all channels as raw XML. The guide is generated from channel schedules and can be used as an EPG source in media players like VLC or Kodi alongside the M3U playlist. This is a read-only operation that mutates nothing and returns the XMLTV document as text.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const xmltv = await client.getXmltvPlaylist();
      return {
        content: [{ type: "text", text: xmltv }],
      };
    },
  );

  server.registerTool(
    "get_channel_stream_url",
    {
      description:
        "Get a direct stream URL for a specific channel that players like VLC or Kodi can use to watch or record its live stream. Use this when a single-channel link is needed instead of the full M3U playlist; obtain channel IDs via list_channels. This is a read-only operation that mutates nothing and returns the stream URL details as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get the stream URL for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const streamUrl = await client.getChannelStreamUrl(id);
      return {
        content: [{ type: "text", text: JSON.stringify(streamUrl, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_channel_stream",
    {
      description:
        "Get a direct playable stream URL for a specific channel, suitable for pasting into media players like VLC or Kodi to watch its live stream. Use this when you need a single-channel link rather than the full M3U playlist; obtain channel IDs via list_channels. This is a read-only operation that mutates nothing and returns the channel ID and stream URL as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get a stream URL for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const streamUrl = await client.getDirectChannelStreamUrl(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ channelId: id, url: streamUrl }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_channel_m3u8",
    {
      description:
        "Get the single-channel HLS (.m3u8) playlist for one Tunarr channel as raw playlist text. Use this when a player needs the channel's HLS master/segment playlist directly rather than the full channels.m3u; obtain channel IDs via list_channels. This is a read-only operation that mutates nothing and returns the M3U8 playlist text.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get the HLS playlist for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const playlist = await client.getChannelM3u8(id);
      return {
        content: [{ type: "text", text: playlist }],
      };
    },
  );

  server.registerTool(
    "get_channel_ts",
    {
      description:
        "Get the raw live MPEG-TS stream for a single Tunarr channel as text. This is primarily for debugging: the output is a large, binary-ish live stream rather than normal JSON or playlist text, so it is meant to be inspected, not parsed. Obtain the channel ID via list_channels. This is a read-only operation that mutates nothing.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get the MPEG-TS stream for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const ts = await client.getChannelTs(id);
      return {
        content: [{ type: "text", text: ts }],
      };
    },
  );

  server.registerTool(
    "get_channel_item_stream",
    {
      description:
        "Get the raw stream for a specific Tunarr channel item as text, for low-level access to how a channel item is streamed. This is primarily for debugging: the output is a large, binary-ish live stream, so it is meant to be inspected, not parsed. Obtain the channel ID via list_channels. This is a read-only operation that mutates nothing.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get the item stream for (get available IDs via list_channels)"),
        t: z.string().describe("Required timestamp/cache-buster query parameter (t)"),
      },
    },
    async ({ id, t }) => {
      const stream = await client.getChannelItemStream(id, t);
      return {
        content: [{ type: "text", text: stream }],
      };
    },
  );

  server.registerTool(
    "get_ffmpeg_playlist",
    {
      description:
        "Get a raw HLS or MPEG-TS playlist text generated through Tunarr's ffmpeg-backed streamer for a given channel and mode. Use this when you need a specific stream mode rather than the default channel playlist; obtain channel IDs via list_channels and choose a mode such as 'hls' or 'mpegts'. This is a read-only operation that mutates nothing and returns the playlist text.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        channel: z.string().describe("The channel ID (get available IDs via list_channels)"),
        mode: z.string().describe("Stream mode, e.g. 'hls' or 'mpegts'"),
      },
    },
    async ({ channel, mode }) => {
      const playlist = await client.getFfmpegPlaylist(channel, mode);
      return {
        content: [{ type: "text", text: playlist }],
      };
    },
  );

  server.registerTool(
    "get_etv_channel_diagnostics",
    {
      description:
        "Get ErsatzTV-style streaming diagnostics for a specific channel, useful for troubleshooting why a channel fails to stream on the ErsatzTV backend. Obtain the channel ID via list_channels. This is a read-only lookup and returns the per-channel diagnostics as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The channel ID to get ErsatzTV diagnostics for (get available IDs via list_channels)"),
      },
    },
    async ({ id }) => {
      const diagnostics = await client.getEtvChannelDiagnostics(id);
      return {
        content: [{ type: "text", text: JSON.stringify(diagnostics, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_etv_playout_item",
    {
      description:
        "Get the current ErsatzTV playout item, i.e. what program is currently airing on the ErsatzTV backend. Use this to see what is scheduled to play right now while troubleshooting ErsatzTV streaming. This is a read-only lookup and returns the current playout item as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const item = await client.getEtvPlayoutItem();
      return {
        content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_etv_transcode_compatibility",
    {
      description:
        "Get a transcode compatibility report for a specific Tunarr transcode config, indicating whether the config's settings are compatible with the ErsatzTV backend. Obtain transcode config IDs via list_transcode_configs. This is a read-only lookup and returns the compatibility report as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The transcode config ID to check compatibility for (get available IDs via list_transcode_configs)"),
      },
    },
    async ({ id }) => {
      const compatibility = await client.getEtvTranscodeCompatibility(id);
      return {
        content: [{ type: "text", text: JSON.stringify(compatibility, null, 2) }],
      };
    },
  );

  server.registerTool(
    "clear_channels_m3u_cache",
    {
      description:
        "Clear Tunarr's cached channels.m3u playlist so the next request regenerates it from the current lineup. This is a destructive, cache-invalidation operation: it removes the cached playlist that players like VLC or Kodi rely on, so the next request for the playlist (and any player using the old cache) will regenerate it. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async () => {
      await client.clearChannelsM3uCache();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "channels.m3u cache cleared",
            }),
          },
        ],
      };
    },
  );
}
