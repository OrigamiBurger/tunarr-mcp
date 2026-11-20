import { afterEach, describe, expect, it } from "vitest";
import { registerProgramsTools } from "../src/tools/programs.js";
import { registerChannelsTools } from "../src/tools/channels.js";
import { registerMediaSourcesTools } from "../src/tools/media-sources.js";
import { registerSettingsTools } from "../src/tools/settings.js";
import { registerCustomShowsTools } from "../src/tools/custom-shows.js";
import { registerFillerListsTools } from "../src/tools/filler-lists.js";
import { registerSmartCollectionsTools } from "../src/tools/smart-collections.js";
import {
  createClient,
  mockFetch,
  newServer,
  resetFetch,
  toolHandler,
} from "./helpers.js";

/**
 * Friendly-input normalization suite.
 *
 * The whole point of the normalization layer: an agent passes plain, friendly
 * arguments (e.g. `search_programs({ query: "Voyager" })`) and never has to
 * construct a Tunarr DTO (`{ query: { query: "Voyager" } }`). Each test below
 * drives a tool with friendly args and asserts the request the tool actually
 * sends to the Tunarr client — URL, method, and the transformed DTO body.
 *
 * Backward-compat cases confirm the raw `body:` passthrough still works.
 */

interface LastRequest {
  url: string;
  method: string;
  body: unknown;
}

function lastRequest(): LastRequest {
  const calls = (globalThis.fetch as unknown as {
    mock: { calls: unknown[] };
  }).mock.calls;
  const last = calls[calls.length - 1] as [
    string,
    { method: string; body?: string },
  ];
  return {
    url: last[0],
    method: last[1]?.method,
    body: last[1]?.body ? JSON.parse(last[1].body) : undefined,
  };
}

function makeServer(): ReturnType<typeof newServer> {
  const server = newServer();
  registerProgramsTools(server, createClient());
  registerChannelsTools(server, createClient());
  registerMediaSourcesTools(server, createClient());
  registerSettingsTools(server, createClient());
  registerCustomShowsTools(server, createClient());
  registerFillerListsTools(server, createClient());
  registerSmartCollectionsTools(server, createClient());
  return server;
}

const server = makeServer();

afterEach(() => resetFetch());

// ─── Batch 1: programs ────────────────────────────────────────────────────────

describe("search_programs (friendly)", () => {
  it("wraps `query` into the DTO's query object", async () => {
    mockFetch({
      "/api/programs/search": {
        status: 200,
        body: [{ uuid: "p1", title: "Voyager" }],
      },
    });
    const handler = toolHandler(server, "search_programs");
    const result = await handler({ query: "Voyager" }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/programs/search");
    expect(req.body).toEqual({ query: { query: "Voyager" } });
    expect(result).toBeTruthy();
  });

  it("passes through the other friendly scalar fields", async () => {
    mockFetch({
      "/api/programs/search": { status: 200, body: [] },
    });
    const handler = toolHandler(server, "search_programs");
    await handler(
      { query: "Star Trek", mediaSourceId: "ms-1", libraryId: "lib-1", page: 2, limit: 10 },
      {},
    );
    expect(lastRequest().body).toEqual({
      query: { query: "Star Trek" },
      mediaSourceId: "ms-1",
      libraryId: "lib-1",
      page: 2,
      limit: 10,
    });
  });

  it("still accepts the raw body passthrough (backward compatible)", async () => {
    mockFetch({
      "/api/programs/search": { status: 200, body: [] },
    });
    const handler = toolHandler(server, "search_programs");
    await handler(
      {
        body: {
          query: { query: "legacy" },
          filter: { facets: [{ facetName: "genre", values: ["action"] }] },
        },
      },
      {},
    );
    expect(lastRequest().body).toEqual({
      query: { query: "legacy" },
      filter: { facets: [{ facetName: "genre", values: ["action"] }] },
    });
  });
});

describe("batch_lookup_program_groupings (friendly)", () => {
  it("accepts a friendly externalIds array", async () => {
    mockFetch({
      "/api/program_groupings/batch/lookup": { status: 200, body: [] },
    });
    const handler = toolHandler(server, "batch_lookup_program_groupings");
    await handler({ externalIds: ["g1", "g2"] }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/program_groupings/batch/lookup");
    expect(req.body).toEqual({ externalIds: ["g1", "g2"] });
  });
});

// ─── Batch 2: channels ────────────────────────────────────────────────────────

describe("create_channel (body-only union)", () => {
  it("forwards the raw body to POST /api/channels", async () => {
    mockFetch({
      "/api/channels": { status: 200, body: { id: "ch-2", name: "New", type: "smart" } },
    });
    const handler = toolHandler(server, "create_channel");
    const result = await handler({ body: { name: "New", type: "smart" } }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/channels");
    expect(req.body).toEqual({ name: "New", type: "smart" });
    expect((result as { content: unknown[] }).content).toBeTruthy();
  });
});

describe("update_channel (friendly)", () => {
  it("routes id to the URL and sends friendly fields on PUT", async () => {
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: { id: "ch-1", name: "Renamed" } },
    });
    const handler = toolHandler(server, "update_channel");
    await handler({ id: "ch-1", name: "Renamed", number: 7 }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/channels/ch-1");
    expect(req.body).toEqual({ name: "Renamed", number: 7 });
  });
});

describe("add_program_to_channel (body-only union)", () => {
  it("forwards the raw body to POST /api/channels/:id/programming", async () => {
    mockFetch({
      "/api/channels/ch-1/programming": { status: 200, body: { success: true } },
    });
    const handler = toolHandler(server, "add_program_to_channel");
    await handler({ id: "ch-1", body: { programId: "prog-1" } }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/channels/ch-1/programming");
    expect(req.body).toEqual({ programId: "prog-1" });
  });
});

describe("add_schedule_slot (friendly)", () => {
  it("routes channelId to the URL and sends friendly fields", async () => {
    mockFetch({
      "/api/channels/ch-1/schedule-slots": { status: 200, body: { ok: true } },
    });
    const handler = toolHandler(server, "add_schedule_slot");
    await handler({ channelId: "ch-1", timeZoneOffset: -300, periodMs: 3_600_000 }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/channels/ch-1/schedule-slots");
    expect(req.body).toEqual({ timeZoneOffset: -300, periodMs: 3_600_000 });
  });
});

describe("add_schedule_time_slot (friendly)", () => {
  it("routes channelId to the URL and sends friendly fields", async () => {
    mockFetch({
      "/api/channels/ch-1/schedule-time-slots": { status: 200, body: { ok: true } },
    });
    const handler = toolHandler(server, "add_schedule_time_slot");
    await handler({ channelId: "ch-1", startTomorrow: true }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/channels/ch-1/schedule-time-slots");
    expect(req.body).toEqual({ startTomorrow: true });
  });
});

describe("bulk_add_fillers (friendly)", () => {
  it("sends channelIds + mode to POST /api/channels/bulk/fillers", async () => {
    mockFetch({
      "/api/channels/bulk/fillers": { status: 200, body: { affected: ["ch-1"] } },
    });
    const handler = toolHandler(server, "bulk_add_fillers");
    await handler({ channelIds: ["ch-1", "ch-2"], mode: "add" }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/channels/bulk/fillers");
    expect(req.body).toEqual({ channelIds: ["ch-1", "ch-2"], mode: "add" });
  });
});

// ─── Batch 3: media sources ───────────────────────────────────────────────────

describe("create_media_source (friendly)", () => {
  it("sends friendly fields plus body-supplied type", async () => {
    mockFetch({
      "/api/media-sources": { status: 200, body: { id: "ms-2", name: "My Plex" } },
    });
    const handler = toolHandler(server, "create_media_source");
    await handler(
      { name: "My Plex", uri: "http://plex:32400", body: { type: "plex" } },
      {},
    );
    // body supplies `type`; friendly fields are merged on top.
    expect(lastRequest()).toMatchObject({
      method: "POST",
      body: { type: "plex", name: "My Plex", uri: "http://plex:32400" },
    });
  });
});

describe("update_media_source (friendly)", () => {
  it("routes id to the URL and sends friendly fields", async () => {
    mockFetch({
      "/api/media-sources/ms-1": { status: 200, body: { id: "ms-1", name: "Renamed" } },
    });
    const handler = toolHandler(server, "update_media_source");
    await handler({ id: "ms-1", name: "Renamed" }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/media-sources/ms-1");
    // The build maps `id` onto the DTO alongside friendly fields.
    expect(req.body).toEqual({ id: "ms-1", name: "Renamed" });
  });
});

describe("add_library_to_source (friendly)", () => {
  it("routes id + libraryId to the URL and sends enabled", async () => {
    mockFetch({
      "/api/media-sources/ms-1/libraries/lib-1": { status: 200, body: { enabled: true } },
    });
    const handler = toolHandler(server, "add_library_to_source");
    await handler({ id: "ms-1", libraryId: "lib-1", enabled: true }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/media-sources/ms-1/libraries/lib-1");
    expect(req.body).toEqual({ enabled: true });
  });
});

// ─── Batch 4: settings ────────────────────────────────────────────────────────

describe("update_ffmpeg_settings (friendly)", () => {
  it("sends friendly fields to PUT /api/ffmpeg-settings", async () => {
    mockFetch({ "/api/ffmpeg-settings": { status: 200, body: { ok: true } } });
    const handler = toolHandler(server, "update_ffmpeg_settings");
    await handler({ ffmpegExecutablePath: "/usr/bin/ffmpeg", logLevel: "info" }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/ffmpeg-settings");
    expect(req.body).toEqual({ ffmpegExecutablePath: "/usr/bin/ffmpeg", logLevel: "info" });
  });
});

describe("update_hdhr_settings (friendly)", () => {
  it("sends friendly fields to PUT /api/hdhr-settings", async () => {
    mockFetch({ "/api/hdhr-settings": { status: 200, body: { ok: true } } });
    const handler = toolHandler(server, "update_hdhr_settings");
    await handler({ tunerCount: 4, autoDiscoveryEnabled: true }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/hdhr-settings");
    expect(req.body).toEqual({ tunerCount: 4, autoDiscoveryEnabled: true });
  });
});

describe("update_plex_settings (friendly)", () => {
  it("sends friendly fields to PUT /api/plex-settings", async () => {
    mockFetch({ "/api/plex-settings": { status: 200, body: { ok: true } } });
    const handler = toolHandler(server, "update_plex_settings");
    await handler({ streamPath: "network", updatePlayStatus: true }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/plex-settings");
    expect(req.body).toEqual({ streamPath: "network", updatePlayStatus: true });
  });
});

describe("update_xmltv_settings (friendly)", () => {
  it("sends friendly fields to PUT /api/xmltv-settings", async () => {
    mockFetch({ "/api/xmltv-settings": { status: 200, body: { ok: true } } });
    const handler = toolHandler(server, "update_xmltv_settings");
    await handler({ programmingHours: 24, refreshHours: 12 }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/xmltv-settings");
    expect(req.body).toEqual({ programmingHours: 24, refreshHours: 12 });
  });
});

describe("create_transcode_config (friendly)", () => {
  it("sends friendly fields to POST /api/transcode_configs", async () => {
    mockFetch({ "/api/transcode_configs": { status: 200, body: { id: "tc-2", name: "H.264" } } });
    const handler = toolHandler(server, "create_transcode_config");
    await handler({ name: "H.264", threadCount: 4 }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/transcode_configs");
    expect(req.body).toEqual({ name: "H.264", threadCount: 4 });
  });
});

describe("update_transcode_config (friendly)", () => {
  it("routes id to the URL and sends friendly fields", async () => {
    mockFetch({ "/api/transcode_configs/tc-1": { status: 200, body: { id: "tc-1", name: "Renamed" } } });
    const handler = toolHandler(server, "update_transcode_config");
    await handler({ id: "tc-1", name: "Renamed" }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/transcode_configs/tc-1");
    expect(req.body).toMatchObject({ name: "Renamed" });
    // The DTO is what the client sends; assert the friendly fields made it.
    expect(req.body).toHaveProperty("name", "Renamed");
  });
});

// ─── Batch 5: custom shows ────────────────────────────────────────────────────

describe("create_custom_show (friendly)", () => {
  it("sends friendly fields to POST /api/custom-shows", async () => {
    mockFetch({ "/api/custom-shows": { status: 200, body: { id: "cs-2", name: "My Show" } } });
    const handler = toolHandler(server, "create_custom_show");
    await handler({ name: "My Show", syncMediaSourceId: "ms-1" }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/custom-shows");
    expect(req.body).toEqual({ name: "My Show", syncMediaSourceId: "ms-1" });
  });
});

describe("update_custom_show (friendly)", () => {
  it("throws without id", async () => {
    mockFetch({ "/api/custom-shows/cs-1": { status: 200, body: { id: "cs-1" } } });
    const handler = toolHandler(server, "update_custom_show");
    await expect(handler({ name: "No id" }, {})).rejects.toThrow("id is required");
  });

  it("routes id to the URL and sends friendly fields", async () => {
    mockFetch({ "/api/custom-shows/cs-1": { status: 200, body: { id: "cs-1", name: "Renamed" } } });
    const handler = toolHandler(server, "update_custom_show");
    await handler({ id: "cs-1", name: "Renamed", enableSync: true }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/custom-shows/cs-1");
    expect(req.body).toEqual({ name: "Renamed", enableSync: true });
  });
});

// ─── Batch 6: filler lists ────────────────────────────────────────────────────

describe("create_filler_list (friendly)", () => {
  it("sends friendly fields to POST /api/filler-lists", async () => {
    mockFetch({ "/api/filler-lists": { status: 200, body: { id: "fl-2", name: "Commercials" } } });
    const handler = toolHandler(server, "create_filler_list");
    await handler({ name: "Commercials", streamSelectionProfileId: "ssp-1" }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/filler-lists");
    expect(req.body).toEqual({ name: "Commercials", streamSelectionProfileId: "ssp-1" });
  });
});

describe("update_filler_list (friendly)", () => {
  it("routes id to the URL and sends friendly fields", async () => {
    mockFetch({ "/api/filler-lists/fl-1": { status: 200, body: { id: "fl-1", name: "Renamed" } } });
    const handler = toolHandler(server, "update_filler_list");
    await handler({ id: "fl-1", name: "Renamed" }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/filler-lists/fl-1");
    expect(req.body).toEqual({ name: "Renamed" });
  });
});

// ─── Batch 7: smart collections ───────────────────────────────────────────────

describe("create_smart_collection (friendly)", () => {
  it("sends friendly name + keywords to POST /api/smart_collections", async () => {
    mockFetch({ "/api/smart_collections": { status: 200, body: { id: "sc-2", name: "Movies" } } });
    const handler = toolHandler(server, "create_smart_collection");
    await handler({ name: "Movies", keywords: "action sci-fi" }, {});
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/smart_collections");
    expect(req.body).toEqual({ name: "Movies", keywords: "action sci-fi" });
  });
});

describe("update_smart_collection (friendly)", () => {
  it("routes id to the URL and sends friendly fields", async () => {
    mockFetch({ "/api/smart_collections/sc-1": { status: 200, body: { id: "sc-1", name: "Renamed" } } });
    const handler = toolHandler(server, "update_smart_collection");
    await handler({ id: "sc-1", name: "Renamed", filterString: "genre == action" }, {});
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/smart_collections/sc-1");
    expect(req.body).toEqual({ name: "Renamed", filterString: "genre == action" });
  });
});
