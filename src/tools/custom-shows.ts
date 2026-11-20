import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";
import {
  create_custom_showBodySchema,
  update_custom_showBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerCustomShowsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_custom_shows",
    {
      description:
        "List all custom shows configured in Tunarr. Custom shows aggregate programs across media sources into a single user-defined show, which can then be used as a channel lineup source. Use this to obtain custom show IDs for get_custom_show, update_custom_show, or delete_custom_show. This is a read-only lookup and returns the array of custom show objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const shows = await client.getCustomShows();
      return {
        content: [{ type: "text", text: JSON.stringify(shows, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_custom_show",
    {
      description:
        "Get detailed information about a specific custom show by its ID, including its metadata source configuration and the programs it aggregates. Custom shows pull programs from one or more media sources into a single user-defined show. This is a read-only lookup; get available IDs via list_custom_shows and it returns the full custom show object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The custom show ID (get available IDs via list_custom_shows)"),
      },
    },
    async ({ id }) => {
      const show = await client.getCustomShow(id);
      return {
        content: [{ type: "text", text: JSON.stringify(show, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_custom_show",
    {
      description:
        "Create a new custom show that aggregates programs across media sources into one user-defined show. Specify a name, optional media source sync settings, and any other configuration; the show can afterwards be used as a channel lineup source. This mutates Tunarr by creating a new entity and returns the newly created custom show object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        name: z.string().optional().describe("The custom show name (required)"),
        syncMediaSourceId: z
          .string()
          .optional()
          .describe("The media source to sync from (id from list_media_sources)"),
        syncExternalPlaylistId: z
          .string()
          .optional()
          .describe("The external playlist ID to sync from this media source"),
        streamSelectionProfileId: z
          .string()
          .optional()
          .describe("The stream selection profile ID to use for syncing"),
        body: create_custom_showBodySchema
          .optional()
          .describe("Advanced: raw custom show DTO for programs and other unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        create_custom_showBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          syncMediaSourceId: f.syncMediaSourceId as string | undefined,
          syncExternalPlaylistId: f.syncExternalPlaylistId as string | undefined,
          streamSelectionProfileId: f.streamSelectionProfileId as string | undefined,
        }),
      );
      const show = await client.createCustomShow(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(show, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_custom_show",
    {
      description:
        "Update an existing custom show's configuration, such as its name, sync settings, or program list, without recreating it. Get the custom show ID via list_custom_shows and only include the fields you want to change. This mutates the custom show in place and returns the updated custom show object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().optional().describe("The custom show ID to update (get available IDs via list_custom_shows)"),
        name: z.string().optional().describe("The new custom show name"),
        syncMediaSourceId: z
          .string()
          .optional()
          .describe("The media source to sync from (id from list_media_sources)"),
        syncExternalPlaylistId: z
          .string()
          .optional()
          .describe("The external playlist ID to sync from this media source"),
        streamSelectionProfileId: z
          .string()
          .optional()
          .describe("The stream selection profile ID to use for syncing"),
        enableSync: z
          .boolean()
          .optional()
          .describe("Whether to enable syncing for this custom show"),
        body: update_custom_showBodySchema
          .optional()
          .describe("Advanced: raw custom show DTO for programs and other unexposed fields"),
      },
    },
    async (args) => {
      const id = args.id;
      if (id === undefined) {
        throw new Error("id is required to update a custom show");
      }
      const dto = normalizeToDto(
        args,
        update_custom_showBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          syncMediaSourceId: f.syncMediaSourceId as string | undefined,
          syncExternalPlaylistId: f.syncExternalPlaylistId as string | undefined,
          streamSelectionProfileId: f.streamSelectionProfileId as string | undefined,
          enableSync: f.enableSync as boolean | undefined,
        }),
      );
      const show = await client.updateCustomShow(id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(show, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_custom_show",
    {
      description:
        "Permanently delete a custom show by its ID, removing the show and all of its program associations. This is a destructive, irreversible operation; channels referencing the show may lose that lineup source, so verify the ID with list_custom_shows first. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The custom show ID to delete (get available IDs via list_custom_shows)"),
      },
    },
    async ({ id }) => {
      await client.deleteCustomShow(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Custom show ${id} deleted` }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_custom_show_programs",
    {
      description:
        "List the programs aggregated by a specific custom show by its ID. Custom shows aggregate programs across media sources into a single user-defined show and can be used as a channel lineup source. Use this to see exactly which programs a custom show contains; get the custom show ID via list_custom_shows. This is a read-only lookup and returns the array of program objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The custom show ID (get available IDs via list_custom_shows)"),
      },
    },
    async ({ id }) => {
      const programs = await client.getCustomShowPrograms(id);
      return {
        content: [{ type: "text", text: JSON.stringify(programs, null, 2) }],
      };
    },
  );
}
