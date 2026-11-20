import { afterEach, describe, expect, it } from "vitest";
import { registerChannelsTools } from "../src/tools/channels.js";
import {
  createClient,
  jsonOf,
  mockFetch,
  newServer,
  resetFetch,
  textOf,
  toolHandler,
} from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerChannelsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_channels tool", () => {
  it("returns the list of channels as JSON text", async () => {
    mockFetch({
      "/api/channels": { status: 200, body: [{ id: "ch-1", name: "Channel 1" }] },
    });
    const handler = toolHandler(makeServer(), "list_channels");
    const result = await handler({}, {});
    const channels = jsonOf(result);
    expect(Array.isArray(channels)).toBe(true);
    expect(channels).toHaveLength(1);
    expect((channels as Array<{ name: string }>)[0].name).toBe("Channel 1");
  });
});

describe("get_channel tool", () => {
  it("returns a single channel", async () => {
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: { id: "ch-1", name: "Channel 1" } },
    });
    const handler = toolHandler(makeServer(), "get_channel");
    const result = await handler({ id: "ch-1" }, {});
    expect(jsonOf(result)).toEqual({ id: "ch-1", name: "Channel 1" });
  });

  it("throws a descriptive error on 404", async () => {
    mockFetch({
      "/api/channels/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "get_channel");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("create_channel tool", () => {
  it("sends the body to the client and returns the created channel", async () => {
    mockFetch({
      "/api/channels": {
        status: 200,
        body: { id: "ch-2", name: "New Channel", type: "smart" },
      },
    });
    const handler = toolHandler(makeServer(), "create_channel");
    const result = await handler(
      { body: { name: "New Channel", type: "smart" } },
      {},
    );
    const created = jsonOf(result) as { name: string };
    expect(created.name).toBe("New Channel");
  });

  it("verifies the request used POST", async () => {
    mockFetch({
      "/api/channels": { status: 200, body: { id: "ch-2" } },
    });
    const handler = toolHandler(makeServer(), "create_channel");
    await handler({ body: { name: "New Channel" } }, {});
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/channels"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_channel tool", () => {
  it("sends id + body via PUT", async () => {
    mockFetch({
      "/api/channels/ch-1": {
        status: 200,
        body: { id: "ch-1", name: "Renamed" },
      },
    });
    const handler = toolHandler(makeServer(), "update_channel");
    const result = await handler(
      { id: "ch-1", body: { name: "Renamed" } },
      {},
    );
    expect((jsonOf(result) as { name: string }).name).toBe("Renamed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/channels/ch-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("delete_channel tool", () => {
  it("reports success", async () => {
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: null },
    });
    const handler = toolHandler(makeServer(), "delete_channel");
    const result = await handler({ id: "ch-1" }, {});
    expect(textOf(result)).toContain("Channel ch-1 deleted");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/channels/ch-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("get_channel_schedule tool", () => {
  it("returns the schedule payload", async () => {
    mockFetch({
      "/api/channels/ch-1/schedule": {
        status: 200,
        body: { slots: [{ name: "Morning", start: "06:00" }] },
      },
    });
    const handler = toolHandler(makeServer(), "get_channel_schedule");
    const result = await handler({ channelId: "ch-1" }, {});
    expect(jsonOf(result)).toHaveProperty("slots");
  });

  it("throws on server error", async () => {
    mockFetch({
      "/api/channels/ch-1/schedule": { status: 500, body: null },
    });
    const handler = toolHandler(makeServer(), "get_channel_schedule");
    await expect(handler({ channelId: "ch-1" }, {})).rejects.toThrow(
      "Tunarr request failed: 500",
    );
  });
});
