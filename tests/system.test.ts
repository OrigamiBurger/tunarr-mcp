import { afterEach, describe, expect, it } from "vitest";
import { registerSystemTools } from "../src/tools/system.js";
import { createClient, jsonOf, mockFetch, newServer, resetFetch, toolHandler } from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerSystemTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("get_system_health tool", () => {
  it("returns the system health entries", async () => {
    mockFetch({
      "/api/system/health": {
        status: 200,
        body: { database: { status: "healthy" }, guide: { status: "info" } },
      },
    });
    const handler = toolHandler(makeServer(), "get_system_health");
    const health = jsonOf(await handler({}, {})) as { database: { status: string } };
    expect(health.database.status).toBe("healthy");
  });

  it("throws on server error", async () => {
    mockFetch({ "/api/system/health": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_system_health");
    await expect(handler({}, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("get_version tool", () => {
  it("returns version info for tunarr, ffmpeg, and node", async () => {
    mockFetch({
      "/api/version": {
        status: 200,
        body: { tunarr: "1.2.3", ffmpeg: "6.0", node: "18.0.0" },
      },
    });
    const handler = toolHandler(makeServer(), "get_version");
    const version = jsonOf(await handler({}, {})) as { tunarr: string };
    expect(version.tunarr).toBe("1.2.3");
  });
});

describe("get_ffmpeg_info tool", () => {
  it("returns the ffmpeg encoders", async () => {
    mockFetch({
      "/api/ffmpeg-info": {
        status: 200,
        body: { videoEncoders: ["libx264", "h264_nvenc"], audioEncoders: ["aac"] },
      },
    });
    const handler = toolHandler(makeServer(), "get_ffmpeg_info");
    const info = jsonOf(await handler({}, {})) as { videoEncoders: string[] };
    expect(info.videoEncoders).toContain("h264_nvenc");
  });
});

describe("list_tasks tool", () => {
  it("returns the list of background tasks", async () => {
    mockFetch({
      "/api/tasks": {
        status: 200,
        body: [{ id: "refresh-guide", name: "Refresh Guide" }],
      },
    });
    const handler = toolHandler(makeServer(), "list_tasks");
    const tasks = jsonOf(await handler({}, {})) as Array<{ id: string }>;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("refresh-guide");
  });
});

describe("run_task tool", () => {
  it("POSTs to the task run endpoint", async () => {
    mockFetch({
      "/api/tasks/refresh-guide/run": { status: 200, body: { success: true } },
    });
    const handler = toolHandler(makeServer(), "run_task");
    const result = await handler({ taskId: "refresh-guide" }, {});
    expect(jsonOf(result)).toEqual({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tasks/refresh-guide/run"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("get_system_state tool", () => {
  it("returns the system state", async () => {
    mockFetch({
      "/api/system/state": {
        status: 200,
        body: { runtime: { uptime: 3600 }, memory: { used: 512 } },
      },
    });
    const handler = toolHandler(makeServer(), "get_system_state");
    const state = jsonOf(await handler({}, {})) as { runtime: { uptime: number } };
    expect(state.runtime.uptime).toBe(3600);
  });
});
