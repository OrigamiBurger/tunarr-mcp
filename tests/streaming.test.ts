import { afterEach, describe, expect, it } from "vitest";
import { registerStreamingTools } from "../src/tools/streaming.js";
import { createClient, jsonOf, mockFetch, newServer, resetFetch, textOf, toolHandler } from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerStreamingTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("get_m3u_playlist tool", () => {
  const m3u = "#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://example.com/stream1\n";

  it("returns the raw M3U text", async () => {
    mockFetch({ "/api/channels.m3u": { status: 200, rawText: m3u, contentType: "text/plain" } });
    const handler = toolHandler(makeServer(), "get_m3u_playlist");
    const result = await handler({}, {});
    expect(textOf(result)).toBe(m3u);
  });

  it("throws on server error", async () => {
    mockFetch({ "/api/channels.m3u": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_m3u_playlist");
    await expect(handler({}, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("get_xmltv_playlist tool", () => {
  const xmltv = '<?xml version="1.0"?><tv></tv>';

  it("returns the raw XMLTV text", async () => {
    mockFetch({ "/api/xmltv.xml": { status: 200, rawText: xmltv, contentType: "text/xml" } });
    const handler = toolHandler(makeServer(), "get_xmltv_playlist");
    const result = await handler({}, {});
    expect(textOf(result)).toBe(xmltv);
  });

  it("throws on server error", async () => {
    mockFetch({ "/api/xmltv.xml": { status: 500, body: null } });
    const handler = toolHandler(makeServer(), "get_xmltv_playlist");
    await expect(handler({}, {})).rejects.toThrow("Tunarr request failed: 500");
  });
});

describe("get_channel_stream_url tool", () => {
  it("returns the stream URL for a channel", async () => {
    mockFetch({
      "/api/channels/ch-1/stream": {
        status: 200,
        body: { url: "http://server:8080/hls/stream.m3u8", protocol: "hls" },
      },
    });
    const handler = toolHandler(makeServer(), "get_channel_stream_url");
    const result = jsonOf(await handler({ id: "ch-1" }, {})) as { url: string };
    expect(result.url).toBe("http://server:8080/hls/stream.m3u8");
  });

  it("throws on 404", async () => {
    mockFetch({ "/api/channels/missing/stream": { status: 404, body: { error: "Not found" } } });
    const handler = toolHandler(makeServer(), "get_channel_stream_url");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow("Tunarr request failed: 404");
  });
});
