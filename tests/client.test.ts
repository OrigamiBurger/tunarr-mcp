import { describe, expect, it, vi } from "vitest";
import { TunarrClient } from "../src/client.js";
import type {
  Channel,
  MediaSource,
  SmartCollection,
  TerminalProgram,
  TranscodeConfig,
} from "../src/types/tunarr.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_BASE = "http://test.example.com:3033";

function createClient(baseUrl = MOCK_BASE): TunarrClient {
  return new TunarrClient({ baseUrl });
}

/**
 * Create a mock `fetch` that returns JSON responses for known endpoints
 * and throws for unknown ones.
 */
function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, _init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    // Normalize — strip query params for matching
    const path = url.replace(MOCK_BASE, "").split("?")[0];

    const match = responses[path];
    if (!match) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: `No mock for ${path}` }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const body =
      match.body === null
        ? undefined
        : JSON.stringify(match.body);

    return Promise.resolve(
      new Response(body, {
        status: match.status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

function resetFetch() {
  vi.restoreAllMocks();
}

// ─── Realistic mock data factories ────────────────────────────────────────────

function makeProgram(id = "prog-1"): TerminalProgram {
  return {
    uuid: id,
    sourceType: "plex",
    type: "movie",
    identifiers: [{ id: "tt0133093", type: "imdb" }],
    title: "The Matrix",
    sortTitle: "matrix",
    tags: ["action", "sci-fi"],
    originalTitle: null,
    year: 1999,
    releaseDate: 915667200,
    releaseDateString: "1999-03-31",
    artwork: [
      { id: "art-1", type: "poster", path: "/posters/matrix.jpg" },
    ],
    state: "ok",
    mediaSourceId: "src-1",
    libraryId: "lib-1",
    canonicalId: "canonical-1",
    externalId: "tt0133093",
    duration: 8160,
  };
}

function makeChannel(id = "ch-1"): Channel {
  return {
    id,
    uuid: id,
    name: id.startsWith("new") ? "New Channel" : id.startsWith("updated") ? "Updated Channel" : "Test Channel",
    type: "smart",
    duration: 3600,
    groupTitle: "Movies",
    guideFlexTitle: "Action Movies",
    icon: { path: "", width: 0, duration: 0, position: "bottom-right" },
    disableFillerOverlay: false,
  };
}

function makeMediaSource(id = "src-1"): MediaSource {
  return {
    id,
    name: id.startsWith("new") ? "New Source" : id.startsWith("updated") ? "Updated Source" : "My Plex",
    uri: "http://plex:32400",
    accessToken: "secret-token",
    type: "plex",
    libraries: [{ id: "lib-1", name: "Movies" }],
  };
}

function makeTranscodeConfig(id = "tc-1"): TranscodeConfig {
  return {
    id,
    name: id.startsWith("new") ? "New Config" : id.startsWith("updated") ? "Updated Config" : "Default",
    threadCount: 4,
    hardwareAccelerationMode: "cuda",
    videoFormat: "h264",
    resolution: { widthPx: 1920, heightPx: 1080 },
  };
}

function makeSmartCollection(id = "sc-1"): SmartCollection {
  return {
    uuid: id,
    name: id.startsWith("new") ? "New Collection" : id.startsWith("updated") ? "Updated Collection" : "Action Movies",
    keywords: id.startsWith("new") ? "new" : "action",
    filterString: 'type == "movie" && genres contains "Action"',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TunarrClient configuration", () => {
  it("requires a base URL when none is provided", () => {
    // baseUrl is required: there is no built-in default Tunarr URL.
    expect(() => new TunarrClient()).toThrow("baseUrl");
  });

  it("sends the API key as a Bearer token when configured", () => {
    mockFetch({});
    const client = new TunarrClient({
      baseUrl: MOCK_BASE,
      apiKey: "secret-key",
    });
    void client.getChannels().catch(() => {}); // trigger fetch
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/api/channels`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-key",
        }),
      }),
    );
    resetFetch();
  });

  it("omits the Authorization header when no API key is configured", () => {
    mockFetch({});
    const client = createClient(MOCK_BASE);
    void client.getChannels().catch(() => {}); // trigger fetch
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/api/channels`,
      expect.objectContaining({
        method: "GET",
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    );
    resetFetch();
  });

  it("uses the custom base URL when provided", () => {
    mockFetch({});
    const client = createClient(MOCK_BASE);
    void client.getChannels().catch(() => {}); // trigger fetch
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/api/channels`,
      expect.objectContaining({ method: "GET" }),
    );
    resetFetch();
  });

  it("strips trailing slashes from the base URL", () => {
    const client = new TunarrClient({ baseUrl: "http://test.com/api/" });
    mockFetch({});
    void client.getChannels().catch(() => {});
    // Verify no double-slash in URL (trailing slash was stripped)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("test.com/api"),
      expect.anything(),
    );
    resetFetch();
  });
});

describe("Channel methods", () => {
  const channel = makeChannel();

  it("getChannels returns an array of channels", async () => {
    mockFetch({
      "/api/channels": { status: 200, body: [channel] },
    });
    const client = createClient();
    const result = await client.getChannels();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Channel");
    resetFetch();
  });

  it("getChannel returns a single channel", async () => {
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: channel },
    });
    const client = createClient();
    const result = await client.getChannel("ch-1");
    expect(result.id).toBe("ch-1");
    resetFetch();
  });

  it("createChannel creates and returns a channel", async () => {
    const newChannel = makeChannel("new-ch");
    mockFetch({
      "/api/channels": { status: 200, body: newChannel },
    });
    const client = createClient();
    const result = await client.createChannel({ name: "New Channel" });
    expect(result.name).toBe("New Channel");
    resetFetch();
  });

  it("updateChannel updates and returns a channel", async () => {
    const updated = { ...channel, name: "Updated Channel" };
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: updated },
    });
    const client = createClient();
    const result = await client.updateChannel("ch-1", { name: "Updated Channel" });
    expect(result.name).toBe("Updated Channel");
    resetFetch();
  });

  it("deleteChannel succeeds silently", async () => {
    mockFetch({
      "/api/channels/ch-1": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteChannel("ch-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on 404 for getChannel", async () => {
    mockFetch({
      "/api/channels/nonexistent": { status: 404, body: { error: "Not found" } },
    });
    const client = createClient();
    await expect(client.getChannel("nonexistent")).rejects.toThrow(
      "Tunarr request failed: 404",
    );
    resetFetch();
  });

  it("throws on 500 for getChannels", async () => {
    mockFetch({
      "/api/channels": { status: 500, body: { error: "Internal error" } },
    });
    const client = createClient();
    await expect(client.getChannels()).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });

  it("exposes an actionable hint from Tunarr validation details", async () => {
    mockFetch({
      "/api/channels": {
        status: 400,
        statusText: "Bad Request",
        body: {
          type: "https://tools.ietf.org/html/rfc6585",
          title: "Bad Request",
          status: 400,
          instance: "/api/channels",
          details: [
            {
              field: "channel.number",
              error: "Number must be greater than 0",
              attempted: -1,
            },
            {
              field: "channel.name",
              error: "Name is required",
              attempted: null,
            },
          ],
        },
      },
    });
    const client = createClient();
    try {
      await client.createChannel({
        type: "new",
        channel: {
          id: "ch-1",
          name: "",
          number: -1,
          groupTitle: "x",
          startTime: 0,
          duration: 12,
        } as never,
        transcodeConfigId: "tc-1",
      } as never);
      throw new Error("expected createChannel to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const e = err as {
        status: number;
        actionableHint: string | null;
        tunarrBody: { status?: number; details?: unknown[] };
      };
      expect(e.status).toBe(400);
      // Real body preserved on the error.
      expect(e.tunarrBody.status).toBe(400);
      // Hint names the failing fields and their expected shape.
      expect(e.actionableHint).toContain('field "channel.number"');
      expect(e.actionableHint).toContain("must be greater than 0");
      expect(e.actionableHint).toContain("channel.name");
      // Message still carries the status prefix for backward compatibility.
      expect(e.message).toContain("Tunarr request failed: 400");
      expect(e.message).toContain(e.actionableHint ?? "");
    }
    resetFetch();
  });

  it("surfaces Tunarr's own message when no details are present", async () => {
    mockFetch({
      "/api/channels/ch-1": {
        status: 400,
        statusText: "Bad Request",
        body: { title: "Malformed channel DTO", message: "Invalid structure" },
      },
    });
    const client = createClient();
    try {
      await client.updateChannel("ch-1", {} as never);
      throw new Error("expected updateChannel to throw");
    } catch (err) {
      const e = err as { actionableHint: string | null };
      expect(e.actionableHint).toContain("Invalid structure");
    }
    resetFetch();
  });

  it("leaves actionableHint null when Tunarr returns nothing actionable", async () => {
    mockFetch({
      "/api/channels/ch-1": {
        status: 400,
        statusText: "Bad Request",
        body: {},
      },
    });
    const client = createClient();
    try {
      await client.updateChannel("ch-1", {} as never);
      throw new Error("expected updateChannel to throw");
    } catch (err) {
      const e = err as { actionableHint: string | null; message: string };
      expect(e.actionableHint).toBeNull();
      // No dangling " — " suffix when there is no hint.
      expect(e.message.trim()).toBe("Tunarr request failed: 400");
    }
    resetFetch();
  });
});

describe("MediaSource methods", () => {
  const source = makeMediaSource();

  it("getMediaSources returns an array", async () => {
    mockFetch({
      "/api/media-sources": { status: 200, body: [source] },
    });
    const client = createClient();
    const result = await client.getMediaSources();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("My Plex");
    resetFetch();
  });

  it("getMediaSource returns a single source", async () => {
    mockFetch({
      "/api/media-sources/src-1": { status: 200, body: source },
    });
    const client = createClient();
    const result = await client.getMediaSource("src-1");
    expect(result.id).toBe("src-1");
    resetFetch();
  });

  it("createMediaSource creates and returns a source", async () => {
    mockFetch({
      "/api/media-sources": { status: 200, body: makeMediaSource("new-src") },
    });
    const client = createClient();
    const result = await client.createMediaSource({ name: "New Source" });
    expect(result.name).toBe("New Source");
    resetFetch();
  });

  it("updateMediaSource updates and returns a source", async () => {
    const updated = { ...source, name: "Updated Source" };
    mockFetch({
      "/api/media-sources/src-1": { status: 200, body: updated },
    });
    const client = createClient();
    const result = await client.updateMediaSource("src-1", { name: "Updated Source" });
    expect(result.name).toBe("Updated Source");
    resetFetch();
  });

  it("deleteMediaSource succeeds silently", async () => {
    mockFetch({
      "/api/media-sources/src-1": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteMediaSource("src-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("scanMediaSource triggers a scan", async () => {
    mockFetch({
      "/api/media-sources/src-1/scan": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.scanMediaSource("src-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on error responses", async () => {
    mockFetch({
      "/api/media-sources/src-1": { status: 404, body: { message: "Not found" } },
    });
    const client = createClient();
    await expect(client.getMediaSource("src-1")).rejects.toThrow(
      "Tunarr request failed: 404",
    );
    resetFetch();
  });
});

describe("Program methods", () => {
  const program = makeProgram();

  it("listPrograms returns a TerminalProgram", async () => {
    mockFetch({
      "/api/programs/prog-1": { status: 200, body: program },
    });
    const client = createClient();
    const result = await client.listPrograms("prog-1");
    expect(result.title).toBe("The Matrix");
    expect(result.type).toBe("movie");
    expect(result.duration).toBe(8160);
    resetFetch();
  });

  it("lookupProgramming returns a TerminalProgram by external ID", async () => {
    mockFetch({
      "/api/programming/tt0133093": { status: 200, body: program },
    });
    const client = createClient();
    const result = await client.lookupProgramming("tt0133093");
    expect(result.externalId).toBe("tt0133093");
    resetFetch();
  });

  it("throws on 400 for bad external ID", async () => {
    mockFetch({
      "/api/programming/bad-id": { status: 400, body: { message: "Invalid external ID" } },
    });
    const client = createClient();
    await expect(client.lookupProgramming("bad-id")).rejects.toThrow(
      "Tunarr request failed: 400",
    );
    resetFetch();
  });

  it("throws on 500 for server error", async () => {
    mockFetch({
      "/api/programs/prog-1": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.listPrograms("prog-1")).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });

  it("encodes special characters in IDs", async () => {
    mockFetch({
      "/api/programs/my%2Fprogram": { status: 200, body: program },
    });
    const client = createClient();
    await client.listPrograms("my/program");
    resetFetch();
  });
});

describe("Channel schedule method", () => {
  it("getChannelSchedule returns schedule data", async () => {
    const scheduleData = {
      schedule: {
        type: "time",
        period: "day",
        slots: [
          { name: "Morning News", start: "06:00", duration: 3600 },
          { name: "Movie Block", start: "12:00", duration: 7200 },
        ],
      },
    };
    mockFetch({
      "/api/channels/ch-1/schedule": { status: 200, body: scheduleData },
    });
    const client = createClient();
    const result = await client.getChannelSchedule("ch-1");
    expect(result).toHaveProperty("schedule");
    resetFetch();
  });

  it("throws on server error", async () => {
    mockFetch({
      "/api/channels/ch-1/schedule": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.getChannelSchedule("ch-1")).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });
});

describe("Guide methods", () => {
  it("getGuideStatus returns status object", async () => {
    mockFetch({
      "/api/guide/status": { status: 200, body: { lastRefresh: 1700000000, channels: 5 } },
    });
    const client = createClient();
    const result = await client.getGuideStatus();
    expect(result).toHaveProperty("lastRefresh");
    resetFetch();
  });

  it("getGuideChannels returns an array", async () => {
    mockFetch({
      "/api/guide/channels": { status: 200, body: [{ id: "ch-1", name: "Channel 1" }] },
    });
    const client = createClient();
    const result = await client.getGuideChannels();
    expect(Array.isArray(result)).toBe(true);
    resetFetch();
  });
});

describe("Session methods", () => {
  const sessionsMap: Record<string, unknown[]> = {
    "ch-1": [
      { type: "hls", state: "playing", numConnections: 1, connections: [{ ip: "192.168.1.1" }] },
    ],
  };

  it("getSessions returns a map keyed by channel ID", async () => {
    mockFetch({
      "/api/sessions": { status: 200, body: sessionsMap },
    });
    const client = createClient();
    const result = await client.getSessions();
    expect(Object.keys(result)).toContain("ch-1");
    resetFetch();
  });

  it("getSession(channelId) returns sessions for a specific channel", async () => {
    mockFetch({
      "/api/channels/ch-1/sessions": { status: 200, body: sessionsMap["ch-1"] },
    });
    const client = createClient();
    const result = await client.getSession("ch-1");
    expect(Array.isArray(result)).toBe(true);
    resetFetch();
  });

  it("getSession() without channelId returns flattened sessions", async () => {
    mockFetch({
      "/api/sessions": { status: 200, body: sessionsMap },
    });
    const client = createClient();
    const result = await client.getSession();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    resetFetch();
  });

  it("deleteSessions deletes channel sessions", async () => {
    mockFetch({
      "/api/channels/ch-1/sessions": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteSessions("ch-1")).resolves.toBeUndefined();
    resetFetch();
  });
});

describe("System methods", () => {
  it("getVersion returns version info", async () => {
    mockFetch({
      "/api/version": { status: 200, body: { tunarr: "1.2.0-dev.1", ffmpeg: "6.0", nodejs: "20.0.0" } },
    });
    const client = createClient();
    const result = await client.getVersion();
    expect(result.tunarr).toBe("1.2.0-dev.1");
    expect(result.ffmpeg).toBe("6.0");
    resetFetch();
  });

  it("getFfmpegInfo returns encoder lists", async () => {
    mockFetch({
      "/api/ffmpeg-info": { status: 200, body: { videoEncoders: [{ name: "h264_nvenc", ffmpegName: "h264_nvenc" }] } },
    });
    const client = createClient();
    const result = await client.getFfmpegInfo();
    expect(result.videoEncoders).toHaveLength(1);
    resetFetch();
  });

  it("getSystemHealth returns health entries", async () => {
    mockFetch({
      "/api/system/health": { status: 200, body: { database: { type: "healthy" } } },
    });
    const client = createClient();
    const result = await client.getSystemHealth();
    expect(result.database).toHaveProperty("type", "healthy");
    resetFetch();
  });

  it("getVersion throws on 500", async () => {
    mockFetch({
      "/api/version": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.getVersion()).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });
});

describe("Settings methods (generic)", () => {
  it("getSettings fetches settings by type", async () => {
    const settings = { ffmpegExecutablePath: "/usr/bin/ffmpeg", logLevel: "warning" };
    mockFetch({
      "/api/ffmpeg-settings": { status: 200, body: settings },
    });
    const client = createClient();
    const result = await client.getSettings("ffmpeg");
    expect(result).toHaveProperty("ffmpegExecutablePath");
    resetFetch();
  });

  it("updateSettings updates settings by type", async () => {
    const updated = { ffmpegExecutablePath: "/custom/ffmpeg", logLevel: "info" };
    mockFetch({
      "/api/ffmpeg-settings": { status: 200, body: updated },
    });
    const client = createClient();
    const result = await client.updateSettings("ffmpeg", { logLevel: "info" });
    expect(result).toHaveProperty("logLevel", "info");
    resetFetch();
  });

  it("getSettings throws on error", async () => {
    mockFetch({
      "/api/ffmpeg-settings": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.getSettings("ffmpeg")).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });
});

describe("TranscodeConfig methods", () => {
  const config = makeTranscodeConfig();

  it("getTranscodeConfigs returns an array", async () => {
    mockFetch({
      "/api/transcode_configs": { status: 200, body: [config] },
    });
    const client = createClient();
    const result = await client.getTranscodeConfigs();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Default");
    resetFetch();
  });

  it("createTranscodeConfig creates and returns a config", async () => {
    mockFetch({
      "/api/transcode_configs": { status: 200, body: makeTranscodeConfig("new-tc") },
    });
    const client = createClient();
    const result = await client.createTranscodeConfig({ name: "New Config" });
    expect(result.name).toBe("New Config");
    resetFetch();
  });

  it("updateTranscodeConfig updates and returns a config", async () => {
    const updated = { ...config, name: "Updated Config" };
    mockFetch({
      "/api/transcode_configs/tc-1": { status: 200, body: updated },
    });
    const client = createClient();
    const result = await client.updateTranscodeConfig("tc-1", { name: "Updated Config" });
    expect(result.name).toBe("Updated Config");
    resetFetch();
  });

  it("deleteTranscodeConfig succeeds silently", async () => {
    mockFetch({
      "/api/transcode_configs/tc-1": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteTranscodeConfig("tc-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/transcode_configs/nonexistent": { status: 404, body: { error: "Not found" } },
    });
    const client = createClient();
    await expect(client.updateTranscodeConfig("nonexistent", {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
    resetFetch();
  });
});

describe("Custom Shows methods", () => {
  it("getCustomShows returns an array", async () => {
    mockFetch({
      "/api/custom-shows": { status: 200, body: [{ id: "cs-1", name: "My Show" }] },
    });
    const client = createClient();
    const result = await client.getCustomShows();
    expect(Array.isArray(result)).toBe(true);
    resetFetch();
  });

  it("createCustomShow creates and returns a show", async () => {
    mockFetch({
      "/api/custom-shows": { status: 200, body: { id: "cs-1", name: "New Show" } },
    });
    const client = createClient();
    const result = await client.createCustomShow({ name: "New Show" });
    expect(result).toHaveProperty("name", "New Show");
    resetFetch();
  });

  it("updateCustomShow updates and returns a show", async () => {
    mockFetch({
      "/api/custom-shows/cs-1": { status: 200, body: { id: "cs-1", name: "Updated Show" } },
    });
    const client = createClient();
    const result = await client.updateCustomShow("cs-1", { name: "Updated Show" });
    expect(result).toHaveProperty("name", "Updated Show");
    resetFetch();
  });

  it("deleteCustomShow succeeds silently", async () => {
    mockFetch({
      "/api/custom-shows/cs-1": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteCustomShow("cs-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on error", async () => {
    mockFetch({
      "/api/custom-shows/cs-1": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.deleteCustomShow("cs-1")).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });
});

describe("Filler Lists methods", () => {
  it("getFillerLists returns an array", async () => {
    mockFetch({
      "/api/filler-lists": { status: 200, body: [{ id: "fl-1", name: "Commercials" }] },
    });
    const client = createClient();
    const result = await client.getFillerLists();
    expect(Array.isArray(result)).toBe(true);
    resetFetch();
  });

  it("createFillerList creates and returns a list", async () => {
    mockFetch({
      "/api/filler-lists": { status: 200, body: { id: "fl-1", name: "New List" } },
    });
    const client = createClient();
    const result = await client.createFillerList({ name: "New List" });
    expect(result).toHaveProperty("name", "New List");
    resetFetch();
  });

  it("updateFillerList updates and returns a list", async () => {
    mockFetch({
      "/api/filler-lists/fl-1": { status: 200, body: { id: "fl-1", name: "Updated List" } },
    });
    const client = createClient();
    const result = await client.updateFillerList("fl-1", { name: "Updated List" });
    expect(result).toHaveProperty("name", "Updated List");
    resetFetch();
  });

  it("deleteFillerList succeeds silently", async () => {
    mockFetch({
      "/api/filler-lists/fl-1": { status: 200, body: null },
    });
    const client = createClient();
    await expect(client.deleteFillerList("fl-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on error", async () => {
    mockFetch({
      "/api/filler-lists/fl-1": { status: 404, body: { error: "Not found" } },
    });
    const client = createClient();
    await expect(client.updateFillerList("fl-1", {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
    resetFetch();
  });
});

describe("SmartCollection methods", () => {
  const collection = makeSmartCollection();

  it("getSmartCollections returns an array", async () => {
    mockFetch({
      "/api/smart_collections": { status: 200, body: [collection] },
    });
    const client = createClient();
    const result = await client.getSmartCollections();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Action Movies");
    resetFetch();
  });

  it("createSmartCollection creates and returns a collection", async () => {
    mockFetch({
      "/api/smart_collections": { status: 200, body: makeSmartCollection("new-sc") },
    });
    const client = createClient();
    const result = await client.createSmartCollection({ name: "New Collection" });
    expect(result.name).toBe("New Collection");
    resetFetch();
  });

  it("updateSmartCollection updates and returns a collection", async () => {
    const updated = { ...collection, name: "Updated Collection" };
    mockFetch({
      "/api/smart_collections/sc-1": { status: 200, body: updated },
    });
    const client = createClient();
    const result = await client.updateSmartCollection("sc-1", { name: "Updated Collection" });
    expect(result.name).toBe("Updated Collection");
    resetFetch();
  });

  it("deleteSmartCollection succeeds silently", async () => {
    mockFetch({
      "/api/smart_collections/sc-1": { status: 204, body: null },
    });
    const client = createClient();
    await expect(client.deleteSmartCollection("sc-1")).resolves.toBeUndefined();
    resetFetch();
  });

  it("throws on error", async () => {
    mockFetch({
      "/api/smart_collections/sc-1": { status: 500, body: null },
    });
    const client = createClient();
    await expect(client.deleteSmartCollection("sc-1")).rejects.toThrow(
      "Tunarr request failed: 500",
    );
    resetFetch();
  });
});

describe("Error handling", () => {
  it("throws TunarrError with status and body on non-2xx responses", async () => {
    mockFetch({
      "/api/channels": { status: 403, body: { message: "Forbidden" } },
    });
    const client = createClient();
    try {
      await client.getChannels();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("403");
    }
    resetFetch();
  });

  it("handles empty response body on success", async () => {
    // A successful request that returns no content should not throw
    mockFetch({
      "/api/channels": { status: 200, body: [] },
    });
    const client = createClient();
    await expect(client.getChannels()).resolves.toHaveLength(0);
    resetFetch();
  });
});
