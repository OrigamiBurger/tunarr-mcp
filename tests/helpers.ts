import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, vi } from "vitest";
import { TunarrClient } from "../src/client.js";

// ─── Shared test helpers ──────────────────────────────────────────────────────
//
// Tool tests follow the same pattern as `client.test.ts`: they register the
// tools under test on a real `McpServer`, pull the compiled `handler` off the
// private `_registeredTools` map, and invoke it with (args, extra). The client
// itself is exercised through a mocked `globalThis.fetch`, so no network calls
// are made.

export const MOCK_BASE = "http://test.example.com:3033";

export function createClient(baseUrl = MOCK_BASE): TunarrClient {
  return new TunarrClient({ baseUrl });
}

/** A fresh McpServer pre-configured with test server metadata. */
export function newServer(): McpServer {
  return new McpServer({ name: "tunarr-mcp-test", version: "0.0.0-test" });
}

export interface MockResponse {
  status: number;
  /** JSON-serializable body. Use `null` for an empty body. Ignored when `rawText` is set. */
  body?: unknown;
  /** When set, `rawText` is returned verbatim (bypassing JSON encoding). */
  rawText?: string;
  contentType?: string;
}

/**
 * Mock `globalThis.fetch` to return JSON (or raw text) responses for known
 * `/api/...` path segments and a 404 JSON error for anything else.
 */
export function mockFetch(responses: Record<string, MockResponse>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path = url.replace(MOCK_BASE, "").split("?")[0];
    const match = responses[path];
    if (!match) {
      return new Response(
        JSON.stringify({ error: `No mock for ${path}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    if (match.rawText !== undefined) {
      return new Response(match.rawText, {
        status: match.status,
        headers: { "Content-Type": match.contentType ?? "text/plain" },
      });
    }
    const body = match.body === null ? "" : JSON.stringify(match.body);
    return new Response(body, {
      status: match.status,
      headers: { "Content-Type": match.contentType ?? "application/json" },
    });
  });
}

export function resetFetch() {
  vi.restoreAllMocks();
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

export type AnyToolHandler = (
  args?: unknown,
  extra?: unknown,
) => Promise<ToolResult> | ToolResult;

/** Pull the compiled handler for a registered tool by name. */
export function toolHandler(
  server: McpServer,
  name: string,
): AnyToolHandler {
  const tools = (server as unknown as {
    _registeredTools: Record<string, { handler: AnyToolHandler }>;
  })._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`Tool "${name}" was not registered`);
  return tool.handler;
}

/** List the names of every tool registered on a server. */
export function listToolNames(server: McpServer): string[] {
  const tools = (server as unknown as {
    _registeredTools: Record<string, unknown>;
  })._registeredTools;
  return Object.keys(tools).sort();
}

/** Extract the first text payload from a tool result. */
export function textOf(result: ToolResult): string {
  const entry = result.content.find((c) => c.type === "text");
  return entry?.text ?? "";
}

/** Parse a JSON text payload returned by a tool. */
export function jsonOf(result: ToolResult): unknown {
  return JSON.parse(textOf(result));
}
