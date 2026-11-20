import { afterEach, describe, expect, it } from "vitest";
import { registerMediaSourcesTools } from "../src/tools/media-sources.js";
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
  registerMediaSourcesTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_media_sources tool", () => {
  it("returns the configured media sources", async () => {
    mockFetch({
      "/api/media-sources": {
        status: 200,
        body: [{ id: "src-1", name: "My Plex", type: "plex" }],
      },
    });
    const handler = toolHandler(makeServer(), "list_media_sources");
    const result = await handler({}, {});
    const sources = jsonOf(result);
    expect(sources).toHaveLength(1);
    expect((sources as Array<{ type: string }>)[0].type).toBe("plex");
  });
});

describe("get_media_source tool", () => {
  it("returns a single source", async () => {
    mockFetch({
      "/api/media-sources/src-1": {
        status: 200,
        body: { id: "src-1", name: "My Plex", type: "plex" },
      },
    });
    const handler = toolHandler(makeServer(), "get_media_source");
    expect(jsonOf(await handler({ id: "src-1" }, {}))).toEqual({
      id: "src-1",
      name: "My Plex",
      type: "plex",
    });
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/media-sources/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "get_media_source");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("create_media_source tool", () => {
  it("POSTs the body and returns the created source", async () => {
    mockFetch({
      "/api/media-sources": {
        status: 200,
        body: { id: "src-2", name: "New Source", type: "plex" },
      },
    });
    const handler = toolHandler(makeServer(), "create_media_source");
    const result = await handler(
      { body: { name: "New Source", type: "plex", uri: "http://plex:32400" } },
      {},
    );
    expect((jsonOf(result) as { name: string }).name).toBe("New Source");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/media-sources"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_media_source tool", () => {
  it("PUTs fields to the source", async () => {
    mockFetch({
      "/api/media-sources/src-1": {
        status: 200,
        body: { id: "src-1", name: "Renamed" },
      },
    });
    const handler = toolHandler(makeServer(), "update_media_source");
    const result = await handler(
      { id: "src-1", body: { name: "Renamed" } },
      {},
    );
    expect((jsonOf(result) as { name: string }).name).toBe("Renamed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/media-sources/src-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("delete_media_source tool", () => {
  it("reports success", async () => {
    mockFetch({ "/api/media-sources/src-1": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "delete_media_source");
    const result = await handler({ id: "src-1" }, {});
    expect(textOf(result)).toContain("Media source src-1 deleted");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/media-sources/src-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("scan_media_source tool", () => {
  it("triggers a scan and reports success", async () => {
    mockFetch({ "/api/media-sources/src-1/scan": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "scan_media_source");
    const result = await handler({ id: "src-1" }, {});
    expect(textOf(result)).toContain("Scan triggered for media source src-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/media-sources/src-1/scan"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("get_media_source_status tool", () => {
  it("returns the source status", async () => {
    mockFetch({
      "/api/media-sources/src-1/status": {
        status: 200,
        body: { scanning: false, libraries: 2 },
      },
    });
    const handler = toolHandler(makeServer(), "get_media_source_status");
    expect(jsonOf(await handler({ id: "src-1" }, {}))).toHaveProperty("libraries");
  });
});
