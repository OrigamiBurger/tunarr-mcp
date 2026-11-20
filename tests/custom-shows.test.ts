import { afterEach, describe, expect, it } from "vitest";
import { registerCustomShowsTools } from "../src/tools/custom-shows.js";
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
  registerCustomShowsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_custom_shows tool", () => {
  it("returns an array of custom shows", async () => {
    mockFetch({
      "/api/custom-shows": { status: 200, body: [{ id: "cs-1", name: "My Show" }] },
    });
    const handler = toolHandler(makeServer(), "list_custom_shows");
    const shows = jsonOf(await handler({}, {})) as Array<{ id: string }>;
    expect(shows).toHaveLength(1);
    expect(shows[0].id).toBe("cs-1");
  });
});

describe("get_custom_show tool", () => {
  it("returns a single custom show", async () => {
    mockFetch({
      "/api/custom-shows/cs-1": { status: 200, body: { id: "cs-1", name: "My Show" } },
    });
    const handler = toolHandler(makeServer(), "get_custom_show");
    expect(jsonOf(await handler({ id: "cs-1" }, {}))).toEqual({
      id: "cs-1",
      name: "My Show",
    });
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/custom-shows/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "get_custom_show");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("create_custom_show tool", () => {
  it("POSTs the body and returns the created show", async () => {
    mockFetch({
      "/api/custom-shows": { status: 200, body: { id: "cs-2", name: "New Show" } },
    });
    const handler = toolHandler(makeServer(), "create_custom_show");
    const result = await handler({ body: { name: "New Show" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("New Show");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/custom-shows"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_custom_show tool", () => {
  it("PUTs fields to the show", async () => {
    mockFetch({
      "/api/custom-shows/cs-1": { status: 200, body: { id: "cs-1", name: "Renamed" } },
    });
    const handler = toolHandler(makeServer(), "update_custom_show");
    const result = await handler({ id: "cs-1", body: { name: "Renamed" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("Renamed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/custom-shows/cs-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("delete_custom_show tool", () => {
  it("reports success", async () => {
    mockFetch({ "/api/custom-shows/cs-1": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "delete_custom_show");
    const result = await handler({ id: "cs-1" }, {});
    expect(textOf(result)).toContain("Custom show cs-1 deleted");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/custom-shows/cs-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
