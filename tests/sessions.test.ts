import { afterEach, describe, expect, it } from "vitest";
import { registerSessionsTools } from "../src/tools/sessions.js";
import { createClient, jsonOf, mockFetch, newServer, resetFetch, textOf, toolHandler } from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerSessionsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_sessions tool", () => {
  it("returns a map keyed by channel ID", async () => {
    mockFetch({
      "/api/sessions": {
        status: 200,
        body: { "ch-1": [{ ip: "192.168.1.1", state: "playing" }] },
      },
    });
    const handler = toolHandler(makeServer(), "list_sessions");
    const sessions = jsonOf(await handler({}, {})) as Record<string, unknown[]>;
    expect(Object.keys(sessions)).toContain("ch-1");
  });
});

describe("get_channel_sessions tool", () => {
  it("returns sessions for a specific channel", async () => {
    mockFetch({
      "/api/channels/ch-1/sessions": {
        status: 200,
        body: [{ ip: "192.168.1.1", state: "playing" }],
      },
    });
    const handler = toolHandler(makeServer(), "get_channel_sessions");
    const result = await handler({ channelId: "ch-1" }, {});
    const sessions = jsonOf(result) as Array<{ state: string }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe("playing");
  });

  it("throws on server error", async () => {
    mockFetch({ "/api/channels/ch-1/sessions": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_channel_sessions");
    await expect(handler({ channelId: "ch-1" }, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("delete_channel_sessions tool", () => {
  it("terminates sessions and reports success", async () => {
    mockFetch({ "/api/channels/ch-1/sessions": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "delete_channel_sessions");
    const result = await handler({ channelId: "ch-1" }, {});
    expect(textOf(result)).toContain("All sessions for channel ch-1 terminated");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/channels/ch-1/sessions"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
