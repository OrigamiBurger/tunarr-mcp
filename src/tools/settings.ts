import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";
import {
  create_transcode_configBodySchema,
  update_ffmpeg_settingsBodySchema,
  update_hdhr_settingsBodySchema,
  update_plex_settingsBodySchema,
  update_transcode_configBodySchema,
  update_xmltv_settingsBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerSettingsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "get_settings",
    {
      description:
        "Get Tunarr settings of a specific type, such as ffmpeg, hdhr, plex, xmltv, transcode_configs, media-source, system, or feature-flags. Read the current configuration with this tool before using any update_*_settings tool, since those calls replace or merge into these values. This is a read-only lookup that returns the settings object for the requested type as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: z
          .string()
          .describe(
            'Settings type: "ffmpeg", "hdhr", "plex", "xmltv", "transcode_configs", "media-source", "system", or "feature-flags"',
          ),
      },
    },
    async ({ type }) => {
      const settings = await client.getSettings(type);
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_ffmpeg_settings",
    {
      description:
        "Update the FFmpeg configuration used to transcode and stream channels, including the executable path and log level. Read the current values first via get_settings with type 'ffmpeg', and check available encoders with get_ffmpeg_info when tuning encoding options. This mutates Tunarr settings and returns the updated FFmpeg settings object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        configVersion: z.number().optional().describe("FFmpeg config version number"),
        ffmpegExecutablePath: z.string().optional().describe("Path to the ffmpeg executable"),
        ffprobeExecutablePath: z.string().optional().describe("Path to the ffprobe executable"),
        enableLogging: z.boolean().optional().describe("Enable logging to the console/log"),
        enableFileLogging: z.boolean().optional().describe("Enable writing logs to a file"),
        logLevel: z
          .enum(["panic","fatal","error","warning","info","verbose","debug","trace"])
          .optional()
          .describe("Log level"),
        transcodeDirectory: z.string().optional().describe("Directory used for transcode output"),
        scalingAlgorithm: z
          .enum(["bicubic","fast_bilinear","lanczos","spline"])
          .optional()
          .describe("Video scaling algorithm"),
        deinterlaceFilter: z
          .enum(["none","bwdif=0","bwdif=1","w3fdif","yadif=0","yadif=1"])
          .optional()
          .describe("Deinterlace filter"),
        hlsDirectOutputFormat: z
          .enum(["mkv","mpegts","mp4"])
          .optional()
          .describe("Direct output container format for HLS"),
        enableSubtitleExtraction: z.boolean().optional().describe("Extract subtitles from streams"),
        body: update_ffmpeg_settingsBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields (e.g. languagePreferences)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_ffmpeg_settingsBodySchema,
        (f) => ({
          configVersion: f.configVersion as number | undefined,
          ffmpegExecutablePath: f.ffmpegExecutablePath as string | undefined,
          ffprobeExecutablePath: f.ffprobeExecutablePath as string | undefined,
          enableLogging: f.enableLogging as boolean | undefined,
          enableFileLogging: f.enableFileLogging as boolean | undefined,
          logLevel: f.logLevel as string | undefined,
          transcodeDirectory: f.transcodeDirectory as string | undefined,
          scalingAlgorithm: f.scalingAlgorithm as string | undefined,
          deinterlaceFilter: f.deinterlaceFilter as string | undefined,
          hlsDirectOutputFormat: f.hlsDirectOutputFormat as string | undefined,
          enableSubtitleExtraction: f.enableSubtitleExtraction as boolean | undefined,
        }),
      );
      const settings = await client.updateSettings("ffmpeg", dto);
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_hdhr_settings",
    {
      description:
        "Update the HDHomeRun tuner settings, including auto-discovery and the number of virtual tuners Tunarr exposes. These settings control how many simultaneous viewers channels can serve when accessed like a physical tuner device. This mutates Tunarr settings; read current values first via get_settings with type 'hdhr', and it returns the updated HDHomeRun settings object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        autoDiscoveryEnabled: z.boolean().optional().describe("Enable automatic HDHomeRun device discovery"),
        tunerCount: z.number().optional().describe("Number of virtual tuners Tunarr exposes"),
        body: update_hdhr_settingsBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_hdhr_settingsBodySchema,
        (f) => ({
          autoDiscoveryEnabled: f.autoDiscoveryEnabled as boolean | undefined,
          tunerCount: f.tunerCount as number | undefined,
        }),
      );
      const settings = await client.updateSettings("hdhr", dto);
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_plex_settings",
    {
      description:
        "Update Plex-specific settings, including the stream path, play status reporting, and path replacement rules that map Plex server paths to local paths. Use this when streams fail to resolve because the Plex server's file paths differ from Tunarr's local paths. This mutates Tunarr settings; read current values first via get_settings with type 'plex', and it returns the updated Plex settings object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        streamPath: z
          .enum(["network","direct"])
          .optional()
          .describe("How streams are addressed ('network' or 'direct')"),
        updatePlayStatus: z.boolean().optional().describe("Report play status back to Plex"),
        pathReplace: z.string().optional().describe("Plex server path segment to replace"),
        pathReplaceWith: z.string().optional().describe("Replacement path segment (local path)"),
        body: update_plex_settingsBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_plex_settingsBodySchema,
        (f) => ({
          streamPath: f.streamPath as string | undefined,
          updatePlayStatus: f.updatePlayStatus as boolean | undefined,
          pathReplace: f.pathReplace as string | undefined,
          pathReplaceWith: f.pathReplaceWith as string | undefined,
        }),
      );
      const settings = await client.updateSettings("plex", dto);
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_xmltv_settings",
    {
      description:
        "Update the XMLTV EPG settings, including how many hours of programming to generate, the refresh interval, the output path, and image/cache options. The XMLTV guide is generated from channel schedules, so these settings affect get_xmltv_playlist and guide output. This mutates Tunarr settings; read current values first via get_settings with type 'xmltv', and it returns the updated XMLTV settings object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        programmingHours: z.number().optional().describe("Hours of EPG programming to generate"),
        refreshHours: z.number().optional().describe("How often to refresh the EPG (hours)"),
        outputPath: z.string().optional().describe("Output path for the generated XMLTV file"),
        enableImageCache: z.boolean().optional().describe("Cache channel images"),
        useShowPoster: z.boolean().optional().describe("Use show posters for EPG images"),
        body: update_xmltv_settingsBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_xmltv_settingsBodySchema,
        (f) => ({
          programmingHours: f.programmingHours as number | undefined,
          refreshHours: f.refreshHours as number | undefined,
          outputPath: f.outputPath as string | undefined,
          enableImageCache: f.enableImageCache as boolean | undefined,
          useShowPoster: f.useShowPoster as boolean | undefined,
        }),
      );
      const settings = await client.updateSettings("xmltv", dto);
      return {
        content: [{ type: "text", text: JSON.stringify(settings, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_transcode_configs",
    {
      description:
        "List all transcode configurations. Each config defines the encoding settings used when streaming, such as resolution, codecs, thread count, and hardware acceleration mode. Use this to obtain transcode config IDs for update_transcode_config and to check which configs exist before creating a new one. This is a read-only lookup that returns the array of transcode config objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const configs = await client.getTranscodeConfigs();
      return {
        content: [{ type: "text", text: JSON.stringify(configs, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_transcode_config",
    {
      description:
        "Create a new transcode configuration defining how streams are encoded, including resolution, video/audio formats, and hardware acceleration mode. Check hardware encoder availability first with get_ffmpeg_info and existing configs with get_transcode_configs to avoid duplicates. This mutates Tunarr by creating a new config and returns the newly created transcode config object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        name: z.string().optional().describe("Config name (required by the DTO)"),
        threadCount: z.number().optional().describe("Number of encoder threads"),
        hardwareAccelerationMode: z
          .enum(["none","cuda","vaapi","qsv","videotoolbox"])
          .optional()
          .describe("Hardware acceleration mode"),
        vaapiDriver: z
          .enum(["system","ihd","i965","radeonsi","nouveau"])
          .optional()
          .describe("VA-API driver name"),
        vaapiDevice: z.string().optional().describe("VA-API device path"),
        videoFormat: z
          .enum(["h264","hevc","mpeg2video"])
          .optional()
          .describe("Video codec format"),
        videoProfile: z.string().optional().describe("Video codec profile"),
        videoPreset: z.string().optional().describe("Video encoding preset"),
        videoBitDepth: z.number().optional().describe("Video bit depth (8 or 10)"),
        videoBitRate: z.number().optional().describe("Video bit rate (bps)"),
        videoBufferSize: z.number().optional().describe("Video buffer size (bps)"),
        audioChannels: z.number().optional().describe("Number of audio channels"),
        audioFormat: z
          .enum(["aac","ac3","copy","mp3","libopus","eac3"])
          .optional()
          .describe("Audio codec format"),
        audioBitRate: z.number().optional().describe("Audio bit rate (bps)"),
        audioBufferSize: z.number().optional().describe("Audio buffer size (bps)"),
        audioSampleRate: z.number().optional().describe("Audio sample rate (Hz)"),
        audioVolumePercent: z.number().optional().describe("Audio volume as a percentage"),
        normalizeFrameRate: z.boolean().optional().describe("Normalize the frame rate"),
        deinterlaceVideo: z.boolean().optional().describe("Deinterlace video"),
        disableChannelOverlay: z.boolean().optional().describe("Disable the channel on-screen overlay"),
        errorScreen: z
          .enum(["static","pic","blank","testsrc","text","kill"])
          .optional()
          .describe("Screen shown when a stream fails"),
        errorScreenAudio: z
          .enum(["silent","sine","whitenoise"])
          .optional()
          .describe("Audio on the error screen"),
        isDefault: z.boolean().optional().describe("Mark this config as the default"),
        disableHardwareDecoder: z.boolean().optional().describe("Disable the hardware decoder"),
        disableHardwareEncoding: z.boolean().optional().describe("Disable the hardware encoder"),
        disableHardwareFilters: z.boolean().optional().describe("Disable hardware-accelerated filters"),
        body: create_transcode_configBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields (e.g. resolution, audioLoudnormConfig)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        create_transcode_configBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          threadCount: f.threadCount as number | undefined,
          hardwareAccelerationMode: f.hardwareAccelerationMode as string | undefined,
          vaapiDriver: f.vaapiDriver as string | undefined,
          vaapiDevice: f.vaapiDevice as string | undefined,
          videoFormat: f.videoFormat as string | undefined,
          videoProfile: f.videoProfile as string | undefined,
          videoPreset: f.videoPreset as string | undefined,
          videoBitDepth: f.videoBitDepth as number | undefined,
          videoBitRate: f.videoBitRate as number | undefined,
          videoBufferSize: f.videoBufferSize as number | undefined,
          audioChannels: f.audioChannels as number | undefined,
          audioFormat: f.audioFormat as string | undefined,
          audioBitRate: f.audioBitRate as number | undefined,
          audioBufferSize: f.audioBufferSize as number | undefined,
          audioSampleRate: f.audioSampleRate as number | undefined,
          audioVolumePercent: f.audioVolumePercent as number | undefined,
          normalizeFrameRate: f.normalizeFrameRate as boolean | undefined,
          deinterlaceVideo: f.deinterlaceVideo as boolean | undefined,
          disableChannelOverlay: f.disableChannelOverlay as boolean | undefined,
          errorScreen: f.errorScreen as string | undefined,
          errorScreenAudio: f.errorScreenAudio as string | undefined,
          isDefault: f.isDefault as boolean | undefined,
          disableHardwareDecoder: f.disableHardwareDecoder as boolean | undefined,
          disableHardwareEncoding: f.disableHardwareEncoding as boolean | undefined,
          disableHardwareFilters: f.disableHardwareFilters as boolean | undefined,
        }),
      );
      const config = await client.createTranscodeConfig(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_transcode_config",
    {
      description:
        "Update an existing transcode configuration, such as its name, thread count, or hardware acceleration mode. Get the config ID via get_transcode_configs and only include the fields you want to change. This mutates the config in place and returns the updated transcode config object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().optional().describe("The transcode config ID (get available IDs via get_transcode_configs)"),
        name: z.string().optional().describe("Config name"),
        threadCount: z.number().optional().describe("Number of encoder threads"),
        hardwareAccelerationMode: z
          .enum(["none","cuda","vaapi","qsv","videotoolbox"])
          .optional()
          .describe("Hardware acceleration mode"),
        vaapiDriver: z
          .enum(["system","ihd","i965","radeonsi","nouveau"])
          .optional()
          .describe("VA-API driver name"),
        vaapiDevice: z.string().optional().describe("VA-API device path"),
        videoFormat: z
          .enum(["h264","hevc","mpeg2video"])
          .optional()
          .describe("Video codec format"),
        videoProfile: z.string().optional().describe("Video codec profile"),
        videoPreset: z.string().optional().describe("Video encoding preset"),
        videoBitDepth: z.number().optional().describe("Video bit depth (8 or 10)"),
        videoBitRate: z.number().optional().describe("Video bit rate (bps)"),
        videoBufferSize: z.number().optional().describe("Video buffer size (bps)"),
        audioChannels: z.number().optional().describe("Number of audio channels"),
        audioFormat: z
          .enum(["aac","ac3","copy","mp3","libopus","eac3"])
          .optional()
          .describe("Audio codec format"),
        audioBitRate: z.number().optional().describe("Audio bit rate (bps)"),
        audioBufferSize: z.number().optional().describe("Audio buffer size (bps)"),
        audioSampleRate: z.number().optional().describe("Audio sample rate (Hz)"),
        audioVolumePercent: z.number().optional().describe("Audio volume as a percentage"),
        normalizeFrameRate: z.boolean().optional().describe("Normalize the frame rate"),
        deinterlaceVideo: z.boolean().optional().describe("Deinterlace video"),
        disableChannelOverlay: z.boolean().optional().describe("Disable the channel on-screen overlay"),
        errorScreen: z
          .enum(["static","pic","blank","testsrc","text","kill"])
          .optional()
          .describe("Screen shown when a stream fails"),
        errorScreenAudio: z
          .enum(["silent","sine","whitenoise"])
          .optional()
          .describe("Audio on the error screen"),
        isDefault: z.boolean().optional().describe("Mark this config as the default"),
        disableHardwareDecoder: z.boolean().optional().describe("Disable the hardware decoder"),
        disableHardwareEncoding: z.boolean().optional().describe("Disable the hardware encoder"),
        disableHardwareFilters: z.boolean().optional().describe("Disable hardware-accelerated filters"),
        body: update_transcode_configBodySchema
          .optional()
          .describe("Advanced: raw DTO for unexposed fields (e.g. resolution, audioLoudnormConfig)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_transcode_configBodySchema,
        (f) => ({
          id: f.id as string | undefined,
          name: f.name as string | undefined,
          threadCount: f.threadCount as number | undefined,
          hardwareAccelerationMode: f.hardwareAccelerationMode as string | undefined,
          vaapiDriver: f.vaapiDriver as string | undefined,
          vaapiDevice: f.vaapiDevice as string | undefined,
          videoFormat: f.videoFormat as string | undefined,
          videoProfile: f.videoProfile as string | undefined,
          videoPreset: f.videoPreset as string | undefined,
          videoBitDepth: f.videoBitDepth as number | undefined,
          videoBitRate: f.videoBitRate as number | undefined,
          videoBufferSize: f.videoBufferSize as number | undefined,
          audioChannels: f.audioChannels as number | undefined,
          audioFormat: f.audioFormat as string | undefined,
          audioBitRate: f.audioBitRate as number | undefined,
          audioBufferSize: f.audioBufferSize as number | undefined,
          audioSampleRate: f.audioSampleRate as number | undefined,
          audioVolumePercent: f.audioVolumePercent as number | undefined,
          normalizeFrameRate: f.normalizeFrameRate as boolean | undefined,
          deinterlaceVideo: f.deinterlaceVideo as boolean | undefined,
          disableChannelOverlay: f.disableChannelOverlay as boolean | undefined,
          errorScreen: f.errorScreen as string | undefined,
          errorScreenAudio: f.errorScreenAudio as string | undefined,
          isDefault: f.isDefault as boolean | undefined,
          disableHardwareDecoder: f.disableHardwareDecoder as boolean | undefined,
          disableHardwareEncoding: f.disableHardwareEncoding as boolean | undefined,
          disableHardwareFilters: f.disableHardwareFilters as boolean | undefined,
        }),
      );
      const config = await client.updateTranscodeConfig(dto.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
      };
    },
  );
}
