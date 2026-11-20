import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";

export function registerTrashTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_trash",
    {
      description:
        "List the items currently in Tunarr's trash, i.e. deleted programs awaiting cleanup. Use this to review what is scheduled for permanent removal before clearing it; the returned IDs can also be resolved via lookup_program. This is a read-only lookup and returns the array of trash items as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const items = await client.listTrash();
      return {
        content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_trash_status",
    {
      description:
        "Get the current status of Tunarr's trash subsystem, including how many items are staged for cleanup and any pending cleanup state. Use this to understand the trash subsystem before listing or clearing it. This is a read-only lookup and returns the trash status object as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const status = await client.getTrashStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  server.registerTool(
    "clear_trash",
    {
      description:
        "Permanently empty Tunarr's trash, irreversibly deleting all items staged for cleanup. This is a destructive, irreversible operation: the trashed programs are removed permanently and cannot be restored, so run list_trash first to review what will be lost and confirm the IDs you intend to delete. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
    },
    async () => {
      await client.clearTrash();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Trash cleared" }),
          },
        ],
      };
    },
  );
}
