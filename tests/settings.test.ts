import { afterEach, describe, expect, it } from "vitest";
import { registerSettingsTools } from "../src/tools/settings.js";
import { createClient, jsonOf, mockFetch, newServer, resetFetch, toolHandler } from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerSettingsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("get_settings tool", () => {
  it("reads ffmpeg settings by type", async () => {
    mockFetch({
      "/api/ffmpeg-settings": {
        status: 200,
        body: { ffmpegExecutablePath: "/usr/bin/ffmpeg", logLevel: "warning" },
      },
    });
    const handler = toolHandler(makeServer(), "get_settings");
    const result = await handler({ type: "ffmpeg" }, {});
    const settings = jsonOf(result) as { logLevel: string };
    expect(settings.logLevel).toBe("warning");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ffmpeg-settings"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws on error", async () => {
    mockFetch({ "/api/plex-settings": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_settings");
    await expect(handler({ type: "plex" }, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("update_ffmpeg_settings tool", () => {
  it("PUTs ffmpeg settings", async () => {
    mockFetch({
      "/api/ffmpeg-settings": {
        status: 200,
        body: { ffmpegExecutablePath: "/custom/ffmpeg", logLevel: "info" },
      },
    });
    const handler = toolHandler(makeServer(), "update_ffmpeg_settings");
    const result = await handler(
      { body: { logLevel: "info", ffmpegExecutablePath: "/custom/ffmpeg" } },
      {},
    );
    const settings = jsonOf(result) as { logLevel: string };
    expect(settings.logLevel).toBe("info");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ffmpeg-settings"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("update_hdhr_settings tool", () => {
  it("PUTs HDHR settings", async () => {
    mockFetch({
      "/api/hdhr-settings": { status: 200, body: { tunerCount: 4 } },
    });
    const handler = toolHandler(makeServer(), "update_hdhr_settings");
    const result = await handler({ body: { tunerCount: 4 } }, {});
    expect(jsonOf(result)).toEqual({ tunerCount: 4 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/hdhr-settings"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("update_plex_settings tool", () => {
  it("PUTs Plex settings", async () => {
    mockFetch({
      "/api/plex-settings": { status: 200, body: { streamPath: "/media" } },
    });
    const handler = toolHandler(makeServer(), "update_plex_settings");
    const result = await handler({ body: { streamPath: "/media" } }, {});
    expect(jsonOf(result)).toEqual({ streamPath: "/media" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/plex-settings"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("update_xmltv_settings tool", () => {
  it("PUTs XMLTV settings", async () => {
    mockFetch({
      "/api/xmltv-settings": { status: 200, body: { programmingHours: 48 } },
    });
    const handler = toolHandler(makeServer(), "update_xmltv_settings");
    const result = await handler({ body: { programmingHours: 48 } }, {});
    expect(jsonOf(result)).toEqual({ programmingHours: 48 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/xmltv-settings"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("get_transcode_configs tool", () => {
  it("returns an array of transcode configs", async () => {
    mockFetch({
      "/api/transcode_configs": {
        status: 200,
        body: [{ id: "tc-1", name: "Default", threadCount: 4 }],
      },
    });
    const handler = toolHandler(makeServer(), "get_transcode_configs");
    const configs = jsonOf(await handler({}, {})) as Array<{ name: string }>;
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe("Default");
  });
});

describe("create_transcode_config tool", () => {
  it("POSTs the body and returns the created config", async () => {
    mockFetch({
      "/api/transcode_configs": {
        status: 200,
        body: { id: "tc-2", name: "New Config", threadCount: 2 },
      },
    });
    const handler = toolHandler(makeServer(), "create_transcode_config");
    const result = await handler(
      { body: { name: "New Config", threadCount: 2 } },
      {},
    );
    const config = jsonOf(result) as { name: string };
    expect(config.name).toBe("New Config");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/transcode_configs"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_transcode_config tool", () => {
  it("PUTs fields to the config", async () => {
    mockFetch({
      "/api/transcode_configs/tc-1": { status: 200, body: { id: "tc-1", name: "Renamed" } },
    });
    const handler = toolHandler(makeServer(), "update_transcode_config");
    const result = await handler({ id: "tc-1", body: { name: "Renamed" } }, {});
    expect(jsonOf(result)).toEqual({ id: "tc-1", name: "Renamed" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/transcode_configs/tc-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/transcode_configs/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "update_transcode_config");
    await expect(handler({ id: "missing", body: {} }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});
