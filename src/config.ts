/**
 * Environment-driven configuration for the Tunarr MCP server.
 *
 * Required:
 *   TUNARR_URL       Base URL of the Tunarr server, e.g. "http://tunarr:8409".
 *                    TUNARR_BASE_URL is still honoured for backward compatibility.
 * Optional:
 *   TUNARR_API_KEY   Sent to Tunarr as `Authorization: Bearer <key>` when set.
 *   PORT             TCP port for the Streamable HTTP MCP server (default 3001).
 *   HOST             Bind address for the HTTP server (default 0.0.0.0).
 */

export interface TunarrMcpConfig {
  /** Base URL of the Tunarr server, without a trailing slash. */
  tunarrUrl: string;
  /** Optional API key sent as `Authorization: Bearer <key>` to Tunarr. */
  apiKey?: string;
  /** TCP port for the HTTP MCP server. */
  port: number;
  /** Bind address for the HTTP server. */
  host: string;
}

export const DEFAULT_PORT = 3001;
export const DEFAULT_HOST = "0.0.0.0";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Load and validate configuration from the given environment (defaults to
 * `process.env`). Throws {@link ConfigError} with an actionable message when
 * required values are missing or malformed.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): TunarrMcpConfig {
  const tunarrUrl = (env.TUNARR_URL ?? env.TUNARR_BASE_URL ?? "").trim();
  if (!tunarrUrl) {
    throw new ConfigError(
      "Missing required environment variable TUNARR_URL. " +
        "Set it to the base URL of your Tunarr server, e.g. TUNARR_URL=http://tunarr:8409. " +
        "(TUNARR_BASE_URL is still accepted for backward compatibility.)",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(tunarrUrl);
  } catch {
    throw new ConfigError(
      `TUNARR_URL must be an absolute http(s) URL (got "${tunarrUrl}"), e.g. http://tunarr:8409`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError(
      `TUNARR_URL must use http:// or https:// (got "${parsed.protocol}//")`,
    );
  }

  const apiKey = (env.TUNARR_API_KEY ?? "").trim() || undefined;

  const port = parsePort(env.PORT ?? "");

  const host = (env.HOST ?? "").trim() || DEFAULT_HOST;

  return {
    tunarrUrl: tunarrUrl.replace(/\/+$/, ""),
    apiKey,
    port,
    host,
  };
}

function parsePort(raw: string): number {
  const value = raw.trim();
  if (!value) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(
      `PORT must be an integer between 1 and 65535 (got "${raw}")`,
    );
  }
  return port;
}
