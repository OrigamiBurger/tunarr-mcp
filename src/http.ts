/**
 * Streamable HTTP entry point.
 *
 * Exposes the MCP server over Streamable HTTP (the primary transport) at
 * `/mcp`, with a health endpoint at `/healthz` for Docker/K8s probes.
 *
 * Follows the official MCP TypeScript SDK stateful pattern: one
 * StreamableHTTPServerTransport + one McpServer per MCP session, keyed by the
 * `mcp-session-id` header. Sessions are removed when the client sends an
 * HTTP DELETE (session termination) or when the transport closes.
 */

import { randomUUID } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { loadConfig, type TunarrMcpConfig } from "./config.js";
import { createTunarrMcpServer, SERVER_VERSION } from "./server.js";

export const MCP_PATH = "/mcp";
export const HEALTH_PATH = "/healthz";

const GRACEFUL_CLOSE_TIMEOUT_MS = 10_000;

function log(message: string): void {
  console.error(`[tunarr-mcp] ${message}`);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

interface McpSession {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
}

export interface TunarrHttpServerHandle {
  /** Bind the HTTP server. Resolves with the actual listening port. */
  start(): Promise<number>;
  /** Close all MCP sessions and stop the HTTP server. */
  stop(): Promise<void>;
  /** Number of currently tracked MCP sessions. */
  activeSessions(): number;
  /** The underlying Node HTTP server (exposed for tests/probes). */
  readonly httpServer: Server;
}

/**
 * Create (but do not start) the Streamable HTTP MCP server.
 */
export function createTunarrHttpServer(
  config: TunarrMcpConfig,
): TunarrHttpServerHandle {
  /** sessionId -> transport+server pair */
  const sessions = new Map<string, McpSession>();

  const httpServer = createHttpServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      log(`Error handling request: ${err instanceof Error ? err.stack : err}`);
      if (!res.headersSent) {
        json(res, 500, { error: "Internal server error" });
      } else {
        res.end();
      }
    });
  });

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === HEALTH_PATH) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (url.pathname !== MCP_PATH) {
      json(res, 404, { error: `Not found; MCP endpoint is ${MCP_PATH}` });
      return;
    }

    const method = (req.method ?? "").toUpperCase();
    if (method !== "POST" && method !== "GET" && method !== "DELETE") {
      json(res, 405, {
        error: "Method not allowed; use POST, GET, or DELETE",
      });
      return;
    }

    const requestedSessionId = getSessionId(req);

    if (method === "POST") {
      const existing = requestedSessionId ? sessions.get(requestedSessionId) : undefined;
      if (existing) {
        await existing.transport.handleRequest(req, res);
        return;
      }
      if (requestedSessionId) {
        // A session id that the server does not know about: the server may
        // have restarted. Per the MCP spec this is a 404.
        json(res, 404, { error: "Session not found" });
        return;
      }
      // No session id: this must be an `initialize` request. Create a new
      // stateful session (transport + McpServer pair).
      await createAndHandleSession(req, res);
      return;
    }

    // GET (SSE stream) / DELETE (session termination) require a session.
    const session = requestedSessionId ? sessions.get(requestedSessionId) : undefined;
    if (!session) {
      json(res, requestedSessionId ? 404 : 400, {
        error: requestedSessionId
          ? "Session not found"
          : `Missing mcp-session-id header (establish a session via POST ${MCP_PATH} first)`,
      });
      return;
    }
    await session.transport.handleRequest(req, res);
  }

  async function createAndHandleSession(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { sessionId, transport });
        log(`MCP session opened: ${sessionId}`);
      },
      onsessionclosed: (sessionId) => {
        if (sessions.delete(sessionId)) {
          log(`MCP session closed: ${sessionId}`);
        }
      },
    });

    // Clean up on any transport close (covers cases beyond HTTP DELETE).
    transport.onclose = () => {
      if (transport.sessionId) {
        if (sessions.delete(transport.sessionId)) {
          log(`MCP session closed: ${transport.sessionId}`);
        }
      }
    };
    transport.onerror = (err) => {
      log(`Transport error in session ${transport.sessionId ?? "?"}: ${err.message}`);
    };

    const { server } = createTunarrMcpServer(config);
    await server.connect(transport);

    // Handle the request (typically `initialize`) on the new transport.
    await transport.handleRequest(req, res);
  }

  return {
    async start(): Promise<number> {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => reject(err);
        httpServer.once("error", onError);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off("error", onError);
          resolve();
        });
      });
      const address = httpServer.address();
      const port =
        typeof address === "object" && address !== null ? address.port : config.port;
      log(
        `Streamable HTTP MCP server listening on http://${config.host}:${port}${MCP_PATH} (Tunarr: ${config.tunarrUrl})`,
      );
      return port;
    },

    async stop(): Promise<void> {
      // Close every MCP session so clients get a clean transport close.
      const closing = [...sessions.values()].map(({ transport }) =>
        transport.close().catch((err) => {
          log(`Error closing session: ${err instanceof Error ? err.message : err}`);
        }),
      );
      sessions.clear();
      await Promise.allSettled(closing);

      // Stop accepting new connections and wait for in-flight requests.
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        // Safety valve: don't hang shutdown on stubborn keep-alive sockets.
        const timer = setTimeout(() => {
          log(`Forcing remaining connections closed after ${GRACEFUL_CLOSE_TIMEOUT_MS}ms`);
          httpServer.closeAllConnections();
          resolve();
        }, GRACEFUL_CLOSE_TIMEOUT_MS);
        timer.unref?.();
      });
      log("HTTP server stopped");
    },

    activeSessions(): number {
      return sessions.size;
    },

    get httpServer(): Server {
      return httpServer;
    },
  };
}

function getSessionId(req: IncomingMessage): string | undefined {
  const value = req.headers["mcp-session-id"];
  if (Array.isArray(value)) return value[0];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function main(): Promise<void> {
  let config: TunarrMcpConfig;
  try {
    config = loadConfig();
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const handle = createTunarrHttpServer(config);
  await handle.start();
  log(`tunarr-mcp v${SERVER_VERSION} ready; health probe at ${HEALTH_PATH}`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}, shutting down gracefully...`);
    try {
      await handle.stop();
      process.exit(0);
    } catch (err) {
      log(`Error during shutdown: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    log(`Uncaught exception: ${err.stack ?? err.message}`);
    process.exit(1);
  });
}

// Run main() only when this module is executed directly (node dist/http.js),
// not when imported by tests.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    log(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
  });
}

// Re-exported for convenience in tests/tools.
export type { TunarrMcpConfig } from "./config.js";
export type { Transport };
