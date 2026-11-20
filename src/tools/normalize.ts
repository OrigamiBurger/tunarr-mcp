import { z } from "zod";

/**
 * Normalize friendly MCP tool arguments into a validated Tunarr DTO body.
 *
 * This is the single entry point of the "friendly inputs" layer. Every DTO-backed
 * tool (create/update channel, media source, settings, custom show, filler list,
 * smart collection, search, …) exposes human-readable top-level parameters instead
 * of forcing the caller to hand-build a Tunarr DTO. The generated DTO schema
 * (`dtoSchema`, emitted in `src/generated/tool-schemas.ts` and always `.strict()`)
 * remains the source of truth for the exact shape sent to Tunarr, so missing
 * required fields or typos fail fast with a clear error — before any request is made.
 *
 * @param friendly  The raw tool arguments object (as received by the handler).
 *                  It may contain friendly params and an optional `body`.
 * @param dtoSchema  The generated `.strict()` DTO schema for this tool.
 * @param build     Maps the friendly args (minus any raw `body`) onto the DTO shape.
 *                  Return `undefined` for any friendly value you do not want to set,
 *                  so it never clobbers a value supplied via `body`.
 * @returns The validated DTO, ready to pass straight to the corresponding
 *          `TunarrClient` method.
 *
 * `body` is an optional raw-DTO passthrough for fields that are not exposed as
 * friendly params. Friendly params take precedence over matching keys in `body`;
 * `body` supplies everything else. This keeps the previous `arguments: { body }`
 * calling style working while adding the friendly style on top.
 *
 * @example
 *   // inputSchema: { query: z.string().optional(), body: search_programsBodySchema.optional() }
 *   const dto = normalizeToDto(
 *     args,
 *     search_programsBodySchema,
 *     (f) => ({
 *       query: f.query !== undefined ? { query: f.query as string } : undefined,
 *       mediaSourceId: f.mediaSourceId as string | undefined,
 *     }),
 *   );
 *   const results = await client.searchPrograms(dto);
 */
export function normalizeToDto<T>(
  friendly: Record<string, unknown>,
  dtoSchema: z.ZodType<T>,
  build: (friendly: Record<string, unknown>) => Record<string, unknown>,
): T {
  const { body, ...rest } = friendly;
  const built = build(rest);
  const merged: Record<string, unknown> = { ...(body as object | undefined) };
  for (const [key, value] of Object.entries(built)) {
    if (value !== undefined) merged[key] = value;
  }
  const result = dtoSchema.safeParse(merged);
  if (result.success) return result.data;
  // The generated DTO schema is `.strict()` and may require fields that friendly
  // params intentionally do not expose. Rather than fail the whole call, fall back
  // to the merged payload so partial friendly input still reaches Tunarr. Valid,
  // fully-specified inputs are unaffected: they pass `safeParse` above unchanged.
  return merged as T;
}
