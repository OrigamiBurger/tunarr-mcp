import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { TunarrMcpConfig } from "../src/config.js";
import {
  createTunarrHttpServer,
  type TunarrHttpServerHandle,
} from "../src/http.js";
import { createTunarrMcpServer } from "../src/server.js";
import { listToolNames } from "./helpers.js";

// ─── Streamable HTTP transport integration ────────────────────────────────────
//
// Spins up the real HTTP server on an ephemeral port (port 0), drives it with a
// real MCP client, and also probes the raw HTTP endpoints directly. Every test
// closes its client and drains active sessions so nothing leaks between tests;
// the server is started once and stopped once at the very end.

const MOCK_HOST = "127.0.0.1";
const MOCK_TUNARR_HOST = "tunarr-mock:1234";

// NOTE: port 0 is intentionally invalid for loadConfig (validated 1-65535), so
// the config is a literal here rather than built via loadConfig.
const config: TunarrMcpConfig = {
  tunarrUrl: "http://tunarr-mock:1234",
  port: 0,
  host: MOCK_HOST,
};

let handle: TunarrHttpServerHandle;
let port: number;
let stopped = false;

// Capture the real fetch BEFORE any spy so the MCP transport (which also uses
// global fetch to reach 127.0.0.1) is never intercepted.
const realFetch = globalThis.fetch;

/**
 * Mock only requests aimed at the Tunarr backend host. Every other URL (the MCP
 * client transport's calls to the local server) is forwarded to the real fetch.
 */
function mockVersionFetch(): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    try {
      const parsed = new URL(url);
      if (parsed.host === MOCK_TUNARR_HOST) {
        return new Response(
          JSON.stringify({ tunarr: "1.2.0-dev.1", ffmpeg: "6.0", nodejs: "20.0.0" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    } catch {
      // Not a resolvable URL — fall through to the real fetch.
    }
    return realFetch(input as Parameters<typeof realFetch>[0], init);
  });
}

/** Poll activeSessions until it drains (or the timeout elapses). */
async function drainSessions(h: TunarrHttpServerHandle, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (h.activeSessions() > 0 && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 25));
  }
}

type TestConnection = {
  client: Client;
  transport: StreamableHTTPClientTransport;
};

async function connectClient(p: number): Promise<TestConnection> {
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://${MOCK_HOST}:${p}/mcp`),
  );
  await client.connect(transport);
  return { client, transport };
}

/**
 * Terminate the server-side session (HTTP DELETE) and then close the client.
 *
 * The SDK's `client.close()` only aborts the local transport and fires
 * `onclose`; it does NOT send the DELETE needed to drop the session on the
 * server, which is why `activeSessions()` would otherwise keep draining until
 * the server stops. Calling `terminateSession()` first makes sessions drain
 * immediately, avoiding cross-test leakage and the ~2s drain timeout.
 */
async function dispose(conn: TestConnection): Promise<void> {
  try {
    await conn.transport.terminateSession();
  } catch {
    // Server may already be shutting down; not fatal.
  }
  await conn.client.close();
}

beforeAll(async () => {
  handle = createTunarrHttpServer(config);
  port = await handle.start();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await drainSessions(handle);
});

afterAll(async () => {
  if (!stopped) {
    await handle.stop();
    stopped = true;
  }
});

describe("HTTP server transport", () => {
  it("listTools returns every registered tool matching the reference server", async () => {
    const conn = await connectClient(port);
    try {
      const res = await conn.client.listTools();
      expect(res.tools.length).toBe(119);

      const names = res.tools.map((t) => t.name).sort();
      const reference = listToolNames(createTunarrMcpServer(config).server);
      expect(names).toEqual(reference);
    } finally {
      await dispose(conn);
    }
  });

  it("tools/call get_version returns the mocked Tunarr version info", async () => {
    mockVersionFetch();
    const conn = await connectClient(port);
    try {
      const result = await conn.client.callTool({
        name: "get_version",
        arguments: {},
      });
      const content = result.content as Array<{ type: string; text: string }>;
      const text = content.find((c) => c.type === "text")?.text ?? "";
      const version = JSON.parse(text) as {
        tunarr: string;
        ffmpeg: string;
        nodejs: string;
      };

      expect(version.tunarr).toBe("1.2.0-dev.1");
      expect(version.ffmpeg).toBe("6.0");
      expect(version.nodejs).toBe("20.0.0");
    } finally {
      vi.restoreAllMocks();
      await dispose(conn);
    }
  });

  it("GET /healthz returns 200 with text/plain \"ok\"", async () => {
    const res = await fetch(`http://${MOCK_HOST}:${port}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("ok");
  });

  it("GET /mcp without an mcp-session-id header returns 400", async () => {
    const res = await fetch(`http://${MOCK_HOST}:${port}/mcp`);
    expect(res.status).toBe(400);
  });

  it("POST /mcp with an unknown session id returns 404", async () => {
    const res = await fetch(`http://${MOCK_HOST}:${port}/mcp`, {
      method: "POST",
      headers: {
        "mcp-session-id": "nonexistent",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /nope returns 404", async () => {
    const res = await fetch(`http://${MOCK_HOST}:${port}/nope`);
    expect(res.status).toBe(404);
  });

  it("stop() closes the server so a follow-up request fails", async () => {
    await handle.stop();
    stopped = true;

    await expect(
      fetch(`http://${MOCK_HOST}:${port}/healthz`),
    ).rejects.toThrow();
  });
});
