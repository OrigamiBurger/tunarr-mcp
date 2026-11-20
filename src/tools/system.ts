import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";

export function registerSystemTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "get_system_health",
    {
      description:
        "Get the overall health status of the Tunarr system, returning health entries for each subsystem (database, guide, streaming, etc.) with status levels such as healthy, info, warning, or error. Use this as the first diagnostic step when something appears wrong, before checking more specific tools like get_guide_status or get_media_source_status. This is a read-only lookup that returns the health entries as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const health = await client.getSystemHealth();
      return {
        content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_version",
    {
      description:
        "Get version information for Tunarr, FFmpeg, and Node.js. Use this when troubleshooting compatibility issues or before reporting problems, for example to check whether a hardware acceleration feature is supported. This is a read-only lookup that returns the version details as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const version = await client.getVersion();
      return {
        content: [{ type: "text", text: JSON.stringify(version, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_ffmpeg_info",
    {
      description:
        "Get the FFmpeg encoders available on the system, both video and audio. Use this to verify hardware acceleration support (e.g. cuda, vaapi, qsv, videotoolbox) and codec availability before creating or updating transcode configs. This is a read-only lookup that returns the encoder information as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const info = await client.getFfmpegInfo();
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_tasks",
    {
      description:
        "List the background tasks available in Tunarr, including guide refreshes, metadata updates, and maintenance operations. Use this to obtain the task IDs required by run_task, for example to refresh the guide after changing channel lineups. This is a read-only lookup that returns the array of tasks and their details as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const tasks = await client.listTasks();
      return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
      };
    },
  );

  server.registerTool(
    "run_task",
    {
      description:
        "Manually trigger a background task by its ID, such as a guide refresh after changing channel lineups or a maintenance operation. Get valid task IDs via list_tasks before calling. This mutates system state by executing the task; it returns the task run result as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        taskId: z
          .string()
          .describe("The task ID to run (get available IDs via list_tasks)"),
      },
    },
    async ({ taskId }) => {
      const result = await client.runTask(taskId);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_system_state",
    {
      description:
        "Get a comprehensive snapshot of the Tunarr system state, including runtime status, active processes, memory usage, and a configuration summary. Use this for in-depth diagnostics when get_system_health alone does not explain a problem. This is a read-only lookup that returns the system state object as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const state = await client.getSystemState();
      return {
        content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
      };
    },
  );
}
