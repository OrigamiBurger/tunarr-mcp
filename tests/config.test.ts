import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_HOST,
  DEFAULT_PORT,
  loadConfig,
} from "../src/config.js";

// ─── loadConfig unit tests ────────────────────────────────────────────────────
//
// Every test passes an explicit env object so process.env is never read or
// mutated. loadConfig reads TUNARR_URL (falling back to TUNARR_BASE_URL),
// validates it as an absolute http(s) URL, trims trailing slashes, trims the
// apiKey, and validates PORT/HOST.

describe("loadConfig", () => {
  it("happy path: strips trailing slash, defaults port/host, apiKey undefined", () => {
    const cfg = loadConfig({ TUNARR_URL: "http://tunarr:8409/" });

    expect(cfg.tunarrUrl).toBe("http://tunarr:8409");
    expect(cfg.port).toBe(DEFAULT_PORT);
    expect(cfg.port).toBe(3001);
    expect(cfg.host).toBe(DEFAULT_HOST);
    expect(cfg.host).toBe("0.0.0.0");
    expect(cfg.apiKey).toBeUndefined();
  });

  it("falls back to TUNARR_BASE_URL when TUNARR_URL is unset", () => {
    const cfg = loadConfig({ TUNARR_BASE_URL: "https://tunarr.example.com/" });

    expect(cfg.tunarrUrl).toBe("https://tunarr.example.com");
    expect(cfg.port).toBe(DEFAULT_PORT);
    expect(cfg.host).toBe(DEFAULT_HOST);
  });

  it("prefers TUNARR_URL over TUNARR_BASE_URL when both are set", () => {
    const cfg = loadConfig({
      TUNARR_URL: "http://primary:1111",
      TUNARR_BASE_URL: "http://fallback:2222",
    });

    expect(cfg.tunarrUrl).toBe("http://primary:1111");
  });

  it("throws ConfigError when neither TUNARR_URL nor TUNARR_BASE_URL is set", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it("throws ConfigError for a non-absolute / unparseable URL", () => {
    expect(() => loadConfig({ TUNARR_URL: "not-a-url" })).toThrow(ConfigError);
  });

  it("throws ConfigError for a non-http(s) protocol", () => {
    expect(() => loadConfig({ TUNARR_URL: "ftp://x.example.com" })).toThrow(
      ConfigError,
    );
  });

  it("throws ConfigError for invalid PORT values (0, 70000, abc)", () => {
    expect(() => loadConfig({ TUNARR_URL: "http://tunarr:8409", PORT: "0" })).toThrow(
      ConfigError,
    );
    expect(
      () => loadConfig({ TUNARR_URL: "http://tunarr:8409", PORT: "70000" }),
    ).toThrow(ConfigError);
    expect(
      () => loadConfig({ TUNARR_URL: "http://tunarr:8409", PORT: "abc" }),
    ).toThrow(ConfigError);
  });

  it("respects PORT/HOST and processes the apiKey (trim, whitespace->undefined)", () => {
    const cfg = loadConfig({
      TUNARR_URL: "http://tunarr:9000",
      PORT: "8080",
      HOST: "127.0.0.1",
      TUNARR_API_KEY: "  abc123  ",
    });

    expect(cfg.tunarrUrl).toBe("http://tunarr:9000");
    expect(cfg.port).toBe(8080);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.apiKey).toBe("abc123");
  });

  it("treats a whitespace-only apiKey as undefined", () => {
    const cfg = loadConfig({
      TUNARR_URL: "http://tunarr:9000",
      TUNARR_API_KEY: "   ",
    });

    expect(cfg.apiKey).toBeUndefined();
  });
});
