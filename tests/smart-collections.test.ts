import { afterEach, describe, expect, it } from "vitest";
import { registerSmartCollectionsTools } from "../src/tools/smart-collections.js";
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
  registerSmartCollectionsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_smart_collections tool", () => {
  it("returns an array of smart collections", async () => {
    mockFetch({
      "/api/smart_collections": {
        status: 200,
        body: [{ id: "sc-1", name: "Action Movies", keywords: "action" }],
      },
    });
    const handler = toolHandler(makeServer(), "list_smart_collections");
    const collections = jsonOf(await handler({}, {})) as Array<{ name: string }>;
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe("Action Movies");
  });
});

describe("get_smart_collection tool", () => {
  it("returns a single collection", async () => {
    mockFetch({
      "/api/smart_collections/sc-1": {
        status: 200,
        body: { id: "sc-1", name: "Action Movies", keywords: "action" },
      },
    });
    const handler = toolHandler(makeServer(), "get_smart_collection");
    expect(jsonOf(await handler({ id: "sc-1" }, {}))).toEqual({
      id: "sc-1",
      name: "Action Movies",
      keywords: "action",
    });
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/smart_collections/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "get_smart_collection");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("create_smart_collection tool", () => {
  it("POSTs the body and returns the created collection", async () => {
    mockFetch({
      "/api/smart_collections": {
        status: 200,
        body: { id: "sc-2", name: "New Collection", keywords: "scifi" },
      },
    });
    const handler = toolHandler(makeServer(), "create_smart_collection");
    const result = await handler({ body: { name: "New Collection", keywords: "scifi" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("New Collection");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/smart_collections"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_smart_collection tool", () => {
  it("PUTs fields to the collection", async () => {
    mockFetch({
      "/api/smart_collections/sc-1": { status: 200, body: { id: "sc-1", name: "Renamed" } },
    });
    const handler = toolHandler(makeServer(), "update_smart_collection");
    const result = await handler({ id: "sc-1", body: { name: "Renamed" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("Renamed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/smart_collections/sc-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("delete_smart_collection tool", () => {
  it("reports success", async () => {
    mockFetch({ "/api/smart_collections/sc-1": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "delete_smart_collection");
    const result = await handler({ id: "sc-1" }, {});
    expect(textOf(result)).toContain("Smart collection sc-1 deleted");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/smart_collections/sc-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
