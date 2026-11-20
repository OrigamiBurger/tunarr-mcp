import { afterEach, describe, expect, it } from "vitest";
import { registerFillerListsTools } from "../src/tools/filler-lists.js";
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
  registerFillerListsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("list_filler_lists tool", () => {
  it("returns an array of filler lists", async () => {
    mockFetch({
      "/api/filler-lists": { status: 200, body: [{ id: "fl-1", name: "Commercials" }] },
    });
    const handler = toolHandler(makeServer(), "list_filler_lists");
    const lists = jsonOf(await handler({}, {})) as Array<{ name: string }>;
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe("Commercials");
  });
});

describe("get_filler_list tool", () => {
  it("returns a single filler list", async () => {
    mockFetch({
      "/api/filler-lists/fl-1": { status: 200, body: { id: "fl-1", name: "Commercials" } },
    });
    const handler = toolHandler(makeServer(), "get_filler_list");
    expect(jsonOf(await handler({ id: "fl-1" }, {}))).toEqual({
      id: "fl-1",
      name: "Commercials",
    });
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/filler-lists/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "get_filler_list");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("create_filler_list tool", () => {
  it("POSTs the body and returns the created list", async () => {
    mockFetch({
      "/api/filler-lists": { status: 200, body: { id: "fl-2", name: "New List" } },
    });
    const handler = toolHandler(makeServer(), "create_filler_list");
    const result = await handler({ body: { name: "New List" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("New List");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/filler-lists"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("update_filler_list tool", () => {
  it("PUTs fields to the list", async () => {
    mockFetch({
      "/api/filler-lists/fl-1": { status: 200, body: { id: "fl-1", name: "Renamed" } },
    });
    const handler = toolHandler(makeServer(), "update_filler_list");
    const result = await handler({ id: "fl-1", body: { name: "Renamed" } }, {});
    expect((jsonOf(result) as { name: string }).name).toBe("Renamed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/filler-lists/fl-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("delete_filler_list tool", () => {
  it("reports success", async () => {
    mockFetch({ "/api/filler-lists/fl-1": { status: 200, body: null } });
    const handler = toolHandler(makeServer(), "delete_filler_list");
    const result = await handler({ id: "fl-1" }, {});
    expect(textOf(result)).toContain("Filler list fl-1 deleted");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/filler-lists/fl-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
