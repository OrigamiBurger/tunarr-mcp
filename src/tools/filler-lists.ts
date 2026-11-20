import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TunarrClient } from "../client.js";
import {
  create_filler_listBodySchema,
  update_filler_listBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerFillerListsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_filler_lists",
    {
      description:
        "List all filler lists configured in Tunarr. Filler lists are named pools of programs used to pad gaps in channel schedules, for example between scheduled shows. Use this to obtain filler list IDs for get_filler_list, update_filler_list, or delete_filler_list. This is a read-only lookup and returns the array of filler list objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const lists = await client.getFillerLists();
      return {
        content: [{ type: "text", text: JSON.stringify(lists, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_filler_list",
    {
      description:
        "Get detailed information about a specific filler list by its ID, including the programs it contains and its metadata. Filler lists are named program pools used to pad gaps in channel schedules. This is a read-only lookup; get available IDs via list_filler_lists and it returns the full filler list object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The filler list ID (get available IDs via list_filler_lists)"),
      },
    },
    async ({ id }) => {
      const list = await client.getFillerList(id);
      return {
        content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_filler_list",
    {
      description:
        "Create a new filler list, a named pool of programs used to pad gaps in channel schedules. Specify a name and the programs to include; programs can be identified via lookup_program or lookup_by_external_id. This mutates Tunarr by creating a new entity and returns the newly created filler list object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        name: z.string().optional().describe("Name of the filler list (required by Tunarr)"),
        streamSelectionProfileId: z
          .string()
          .optional()
          .describe("The stream selection profile ID to apply to this filler list"),
        body: create_filler_listBodySchema
          .optional()
          .describe("Advanced: raw create DTO for unexposed fields (e.g. programs)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        create_filler_listBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          streamSelectionProfileId: f.streamSelectionProfileId as string | undefined,
        }),
      );
      const list = await client.createFillerList(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_filler_list",
    {
      description:
        "Update an existing filler list's configuration, such as its name or the programs it contains, without recreating it. Get the filler list ID via list_filler_lists and only include the fields you want to change. This mutates the filler list in place and returns the updated filler list object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The filler list ID to update (get available IDs via list_filler_lists)"),
        name: z.string().optional().describe("New name for the filler list"),
        streamSelectionProfileId: z
          .string()
          .optional()
          .describe("The stream selection profile ID to apply to this filler list"),
        body: update_filler_listBodySchema
          .optional()
          .describe("Advanced: raw update DTO for unexposed fields (e.g. programs)"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_filler_listBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          streamSelectionProfileId: f.streamSelectionProfileId as string | undefined,
        }),
      );
      const list = await client.updateFillerList(args.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_filler_list",
    {
      description:
        "Permanently delete a filler list by its ID, removing the list and all of its program associations. This is a destructive, irreversible operation; channels referencing the list may lose that filler source, so verify the ID with list_filler_lists first. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The filler list ID to delete (get available IDs via list_filler_lists)"),
      },
    },
    async ({ id }) => {
      await client.deleteFillerList(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Filler list ${id} deleted` }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_filler_list_programs",
    {
      description:
        "List the programs contained in a specific filler list by its ID. Filler lists are named pools of programs used to pad gaps in channel schedules. Use this to see exactly which programs a filler list contains; get the filler list ID via list_filler_lists. This is a read-only lookup and returns the array of program objects as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The filler list ID (get available IDs via list_filler_lists)"),
      },
    },
    async ({ id }) => {
      const programs = await client.getFillerListPrograms(id);
      return {
        content: [{ type: "text", text: JSON.stringify(programs, null, 2) }],
      };
    },
  );
}
