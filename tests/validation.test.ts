import { describe, expect, it, afterEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TunarrClient } from "../src/client.js";
import {
  create_channelBodySchema,
  search_programsBodySchema,
} from "../src/generated/tool-schemas.js";
import { registerChannelsTools } from "../src/tools/channels.js";
import { registerCustomShowsTools } from "../src/tools/custom-shows.js";
import { registerFillerListsTools } from "../src/tools/filler-lists.js";
import { registerGuideTools } from "../src/tools/guide.js";
import { registerMediaSourcesTools } from "../src/tools/media-sources.js";
import { registerProgramsTools } from "../src/tools/programs.js";
import { registerSessionsTools } from "../src/tools/sessions.js";
import { registerSettingsTools } from "../src/tools/settings.js";
import { registerSmartCollectionsTools } from "../src/tools/smart-collections.js";
import { registerStreamingTools } from "../src/tools/streaming.js";
import { registerSystemTools } from "../src/tools/system.js";

const MOCK_BASE = "http://test.example.com:3033";

/** Minimal spec-valid channel object for the `type: "new"` create envelope. */
function validChannel(): Record<string, unknown> {
  return {
    disableFillerOverlay: false,
    duration: 60000,
    groupTitle: "General",
    guideMinimumDuration: 0,
    icon: { path: "/icons/test.png", width: 100, duration: 10000 },
    id: "test-channel-id",
    name: "Test Channel",
    number: 1,
    offline: { mode: "pic" },
    startTime: 0,
    stealth: false,
    streamMode: "hls",
    transcodeConfigId: "default",
    subtitlesEnabled: false,
    useEtvNext: false,
  };
}

async function buildConnectedClient(): Promise<Client> {
  const server = new McpServer({ name: "tunarr-mcp-test", version: "0.0.0-test" });
  const tunarrClient = new TunarrClient({ baseUrl: MOCK_BASE });
  registerChannelsTools(server, tunarrClient);
  registerMediaSourcesTools(server, tunarrClient);
  registerProgramsTools(server, tunarrClient);
  registerCustomShowsTools(server, tunarrClient);
  registerFillerListsTools(server, tunarrClient);
  registerSmartCollectionsTools(server, tunarrClient);
  registerSettingsTools(server, tunarrClient);
  registerSessionsTools(server, tunarrClient);
  registerGuideTools(server, tunarrClient);
  registerStreamingTools(server, tunarrClient);
  registerSystemTools(server, tunarrClient);

  const mcpClient = new Client({ name: "tunarr-mcp-test-client", version: "0.0.0-test" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

/** Captured request bodies seen by the mocked fetch. */
let capturedBodies: unknown[] = [];

/** Mock fetch, recording the JSON body of every POST/PUT it sees. */
function captureFetch(respond: Record<string, { status: number; body: unknown }>) {
  capturedBodies = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path = url.replace(MOCK_BASE, "").split("?")[0];
    if (init?.body) {
      try {
        capturedBodies.push(JSON.parse(String(init.body)));
      } catch {
        capturedBodies.push(String(init.body));
      }
    }
    const match = respond[path];
    const payload = match
      ? JSON.stringify(match.body)
      : JSON.stringify({ error: `No mock for ${path}` });
    return new Response(payload, {
      status: match?.status ?? 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tool input validation (typed body schemas)", () => {
  it("create_channel body schema rejects unknown fields with a specific message", () => {
    const result = create_channelBodySchema.safeParse({
      type: "new",
      channel: { ...validChannel(), bogusField: true },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("bogusField");
  });

  it("create_channel rejects a body with an unknown field at the MCP layer", async () => {
    const client = await buildConnectedClient();
    const result = await client.callTool({
      name: "create_channel",
      arguments: {
        body: { type: "new", channel: { ...validChannel(), bogusField: true } },
      },
    });
    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).toContain("create_channel");
  });

  it("create_channel accepts a spec-valid body and forwards it to Tunarr", async () => {
    captureFetch({
      "/api/channels": { status: 201, body: { id: "test-channel-id" } },
    });
    const client = await buildConnectedClient();
    const sent = { type: "new", channel: validChannel() };
    const result = await client.callTool({
      name: "create_channel",
      arguments: { body: sent },
    });
    expect(result.isError).toBeUndefined();
    // Parsed body is forwarded with spec defaults applied (e.g. icon position).
    expect(capturedBodies[0]).toMatchObject(sent);
    expect(
      (capturedBodies[0] as { channel: { icon: { position?: string } } }).channel.icon
        .position,
    ).toBe("bottom-right");
  });

  it("search_programs coerces a bare string query into the query object", async () => {
    captureFetch({
      "/api/programs/search": { status: 200, body: { results: [] } },
    });
    // Schema level: { query: "star trek" } -> { query: { query: "star trek" } }
    const coerced = search_programsBodySchema.parse({ query: "star trek" });
    expect(coerced).toEqual({ query: { query: "star trek" } });

    const client = await buildConnectedClient();
    const result = await client.callTool({
      name: "search_programs",
      arguments: { body: { query: "star trek" } },
    });
    expect(result.isError).toBeUndefined();
    expect(capturedBodies[0]).toEqual({ query: { query: "star trek" } });
  });

  it("update_channel validates its body alongside the id argument", async () => {
    captureFetch({
      "/api/channels/test-channel-id": { status: 200, body: { id: "test-channel-id" } },
    });
    const client = await buildConnectedClient();

    const ok = await client.callTool({
      name: "update_channel",
      // update_channel's body is the flat channel object (no create envelope).
      arguments: { id: "test-channel-id", body: validChannel() },
    });
    expect(ok.isError).toBeUndefined();

    const bad = await client.callTool({
      name: "update_channel",
      arguments: {
        id: "test-channel-id",
        body: { ...validChannel(), nonsense: 1 },
      },
    });
    expect(bad.isError).toBe(true);
  });

  it("search_programs accepts a friendly string query and forwards it to Tunarr", async () => {
    captureFetch({
      "/api/programs/search": { status: 200, body: { results: [] } },
    });
    const client = await buildConnectedClient();
    const result = await client.callTool({
      name: "search_programs",
      arguments: { query: "star trek" },
    });
    expect(result.isError).toBeUndefined();
    expect(capturedBodies[0]).toEqual({ query: { query: "star trek" } });
  });

  it("search_programs rejects a friendly query that is not a string", async () => {
    const client = await buildConnectedClient();
    const result = await client.callTool({
      name: "search_programs",
      arguments: { query: 123 },
    });
    expect(result.isError).toBe(true);
  });

  it("batch_lookup_program_groupings accepts friendly externalIds and forwards them", async () => {
    captureFetch({
      "/api/program_groupings/batch/lookup": { status: 200, body: [] },
    });
    const client = await buildConnectedClient();
    const result = await client.callTool({
      name: "batch_lookup_program_groupings",
      arguments: { externalIds: ["id-1", "id-2"] },
    });
    expect(result.isError).toBeUndefined();
    expect(capturedBodies[0]).toEqual({ externalIds: ["id-1", "id-2"] });
  });
});
