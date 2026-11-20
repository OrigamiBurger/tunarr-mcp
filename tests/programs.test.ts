import { afterEach, describe, expect, it } from "vitest";
import { registerProgramsTools } from "../src/tools/programs.js";
import {
  createClient,
  jsonOf,
  mockFetch,
  newServer,
  resetFetch,
  toolHandler,
} from "./helpers.js";

function makeServer() {
  const server = newServer();
  registerProgramsTools(server, createClient());
  return server;
}

afterEach(() => resetFetch());

describe("lookup_program tool", () => {
  it("returns a program by internal ID", async () => {
    mockFetch({
      "/api/programs/prog-1": {
        status: 200,
        body: { uuid: "prog-1", title: "The Matrix", type: "movie" },
      },
    });
    const handler = toolHandler(makeServer(), "lookup_program");
    const program = jsonOf(await handler({ id: "prog-1" }, {})) as {
      title: string;
    };
    expect(program.title).toBe("The Matrix");
  });

  it("throws on 404", async () => {
    mockFetch({
      "/api/programs/missing": { status: 404, body: { error: "Not found" } },
    });
    const handler = toolHandler(makeServer(), "lookup_program");
    await expect(handler({ id: "missing" }, {})).rejects.toThrow(
      "Tunarr request failed: 404",
    );
  });
});

describe("lookup_by_external_id tool", () => {
  it("returns a program by external ID", async () => {
    mockFetch({
      "/api/programming/tt0133093": {
        status: 200,
        body: { uuid: "prog-1", externalId: "tt0133093" },
      },
    });
    const handler = toolHandler(makeServer(), "lookup_by_external_id");
    const program = jsonOf(await handler({ externalId: "tt0133093" }, {})) as {
      externalId: string;
    };
    expect(program.externalId).toBe("tt0133093");
  });

  it("throws on 400 for a bad external ID", async () => {
    mockFetch({
      "/api/programming/bad": { status: 400, body: { error: "Invalid external ID" } },
    });
    const handler = toolHandler(makeServer(), "lookup_by_external_id");
    await expect(handler({ externalId: "bad" }, {})).rejects.toThrow(
      "Tunarr request failed: 400",
    );
  });
});

describe("get_program_children tool", () => {
  it("returns child programs", async () => {
    mockFetch({
      "/api/programs/season-1/children": {
        status: 200,
        body: [{ uuid: "ep1", title: "Pilot" }, { uuid: "ep2", title: "Second" }],
      },
    });
    const handler = toolHandler(makeServer(), "get_program_children");
    const children = jsonOf(await handler({ id: "season-1" }, {})) as unknown[];
    expect(children).toHaveLength(2);
  });
});

describe("batch_lookup_programs tool", () => {
  it("POSTs the externalIds array and returns results", async () => {
    mockFetch({
      "/api/programming/batch/lookup": {
        status: 200,
        body: [{ uuid: "prog-1", title: "The Matrix" }],
      },
    });
    const handler = toolHandler(makeServer(), "batch_lookup_programs");
    const result = await handler(
      { externalIds: ["tt0133093", "tt0076759"] },
      {},
    );
    const results = jsonOf(result) as unknown[];
    expect(results).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/programming/batch/lookup"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
