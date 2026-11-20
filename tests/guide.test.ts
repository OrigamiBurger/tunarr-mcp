import { afterEach, describe, expect, it } from "vitest";
import { registerGuideTools } from "../src/tools/guide.js";
import { createClient, jsonOf, mockFetch, newServer, resetFetch, toolHandler } from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerGuideTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("get_guide_status tool", () => {
  it("returns the guide status", async () => {
    mockFetch({
      "/api/guide/status": {
        status: 200,
        body: { lastRefresh: 1700000000, channels: 5, progress: 100 },
      },
    });
    const handler = toolHandler(makeServer(), "get_guide_status");
    const status = jsonOf(await handler({}, {})) as { channels: number };
    expect(status.channels).toBe(5);
  });

  it("throws on server error", async () => {
    mockFetch({ "/api/guide/status": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_guide_status");
    await expect(handler({}, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("list_guide_channels tool", () => {
  it("returns an array of guide channels", async () => {
    mockFetch({
      "/api/guide/channels": {
        status: 200,
        body: [{ id: "ch-1", name: "Channel 1" }],
      },
    });
    const handler = toolHandler(makeServer(), "list_guide_channels");
    const channels = jsonOf(await handler({}, {})) as Array<{ id: string }>;
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("ch-1");
  });
});

describe("get_guide_channel tool", () => {
  it("returns guide data for a channel", async () => {
    mockFetch({
      "/api/guide/channels/ch-1": {
        status: 200,
        body: { programs: [{ title: "News", start: "06:00" }] },
      },
    });
    const handler = toolHandler(makeServer(), "get_guide_channel");
    const result = await handler({ id: "ch-1" }, {});
    expect(jsonOf(result)).toHaveProperty("programs");
  });

  it("throws on 404", async () => {
    mockFetch({ "/api/guide/channels/missing": { status: 404, body: { error: "Not found" } } });
    const handler = toolHandler(makeServer(), "get_guide_channel");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow("Tunarr request failed: 404");
  });
});
