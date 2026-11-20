#!/usr/bin/env node
/**
 * Stdio entry point (legacy/secondary transport).
 *
 * Speaks MCP over stdin/stdout, e.g. for local client configs like
 * `command: node /path/to/dist/index.js`. For the primary Streamable HTTP
 * transport, use dist/http.js (see src/http.ts) or the provided Docker image.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, type TunarrMcpConfig } from "./config.js";
import { createTunarrMcpServer, SERVER_VERSION } from "./server.js";

function log(message: string): void {
  console.error(`[tunarr-mcp] ${message}`);
}

export async function main(): Promise<void> {
  let config: TunarrMcpConfig;
  try {
    config = loadConfig();
  } catch (err) {
    // stderr only: stdout is the MCP protocol channel in stdio mode.
    log(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const { server } = createTunarrMcpServer(config);
  await server.connect(new StdioServerTransport());
  log(
    `tunarr-mcp v${SERVER_VERSION} running on stdio (Tunarr: ${config.tunarrUrl})`,
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}, shutting down...`);
    try {
      await server.close();
      process.exit(0);
    } catch (err) {
      log(`Error during shutdown: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
