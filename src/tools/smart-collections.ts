import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SmartCollection } from "../types/tunarr.js";
import { TunarrClient } from "../client.js";
import {
  create_smart_collectionBodySchema,
  update_smart_collectionBodySchema,
} from "../generated/tool-schemas.js";
import { normalizeToDto } from "./normalize.js";

export function registerSmartCollectionsTools(server: McpServer, client: TunarrClient) {
  server.registerTool(
    "list_smart_collections",
    {
      description:
        "List all smart collections configured in Tunarr. Smart collections are keyword or filter-based dynamic program groupings that update automatically and can be used as channel lineup sources. Use this to obtain smart collection IDs for get_smart_collection, update_smart_collection, or delete_smart_collection. This is a read-only lookup that returns the array of smart collection objects as JSON.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const collections = await client.getSmartCollections();
      return {
        content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_smart_collection",
    {
      description:
        "Get detailed information about a specific smart collection by its UUID, including its keyword and filter rules. Smart collections dynamically group programs from the configured media sources based on those rules. This is a read-only lookup; get available IDs via list_smart_collections and it returns the full smart collection object as JSON.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        id: z.string().describe("The smart collection UUID (get available IDs via list_smart_collections)"),
      },
    },
    async ({ id }) => {
      const collection = await client.getSmartCollection(id);
      return {
        content: [{ type: "text", text: JSON.stringify(collection, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_smart_collection",
    {
      description:
        "Create a new smart collection, a keyword or filter-based dynamic program grouping usable as a channel lineup source. Specify a name and either keywords (space-separated search terms) or a filterString for advanced filtering; programs must exist in a configured media source first. This mutates Tunarr by creating a new entity and returns the newly created smart collection object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        name: z.string().describe("Name of the smart collection (required)"),
        keywords: z
          .string()
          .optional()
          .describe("Space-separated search terms to match programs"),
        filterString: z
          .string()
          .optional()
          .describe("Advanced filter query syntax (preferred over keywords for complex rules)"),
        body: create_smart_collectionBodySchema
          .optional()
          .describe("Advanced: raw smart collection DTO for filter and other unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        create_smart_collectionBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          keywords: f.keywords as string | undefined,
          filterString: f.filterString as string | undefined,
        }),
      );
      const collection = await client.createSmartCollection(dto);
      return {
        content: [{ type: "text", text: JSON.stringify(collection, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_smart_collection",
    {
      description:
        "Update an existing smart collection's configuration, such as its name, keywords, or filter rules. Get the smart collection UUID via list_smart_collections and only include the fields you want to change. This mutates the smart collection in place and returns the updated smart collection object as JSON.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The smart collection UUID to update (get available IDs via list_smart_collections)"),
        name: z.string().optional().describe("New name for the smart collection"),
        keywords: z
          .string()
          .optional()
          .describe("Space-separated search terms to match programs"),
        filterString: z
          .string()
          .optional()
          .describe("Advanced filter query syntax (preferred over keywords for complex rules)"),
        body: update_smart_collectionBodySchema
          .optional()
          .describe("Advanced: raw smart collection DTO for filter and other unexposed fields"),
      },
    },
    async (args) => {
      const dto = normalizeToDto(
        args,
        update_smart_collectionBodySchema,
        (f) => ({
          name: f.name as string | undefined,
          keywords: f.keywords as string | undefined,
          filterString: f.filterString as string | undefined,
        }),
      );
      const collection = await client.updateSmartCollection(args.id, dto);
      return {
        content: [{ type: "text", text: JSON.stringify(collection, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_smart_collection",
    {
      description:
        "Permanently delete a smart collection by its UUID, removing the collection and all of its filter rules. This is a destructive, irreversible operation; channels referencing the collection may lose that lineup source, so verify the ID with list_smart_collections first. Returns a JSON confirmation with success and a message.",
      annotations: { destructiveHint: true, readOnlyHint: false },
      inputSchema: {
        id: z.string().describe("The smart collection UUID to delete (get available IDs via list_smart_collections)"),
      },
    },
    async ({ id }) => {
      await client.deleteSmartCollection(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Smart collection ${id} deleted` }),
          },
        ],
      };
    },
  );
}
