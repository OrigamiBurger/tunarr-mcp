// scripts/openapi-to-zod.mjs
//
// Build-time OpenAPI 3.0 -> Zod v4 codegen.
//
// Reads:
//   docs/generated/tunarr-latest-openapi.json   (the live Tunarr OpenAPI spec)
//   scripts/openapi-tool-map.json                (tool name -> operation + coercions)
// Emits:
//   src/generated/tool-schemas.ts
//
// The generated file is imported at runtime by the MCP tool handlers. There is
// NO network access at runtime: the schemas are compiled in at build time, so
// request bodies are validated against the exact OpenAPI shapes. Unknown fields
// are rejected (`.strict()`), wrong shapes are auto-corrected (coercions), and
// the SDK surfaces Zod parse errors as clear InvalidParams messages.
//
// Supported JSON-Schema constructs: type, enum, properties, required, nullable,
// items, default, oneOf, anyOf, allOf, $ref (incl. recursion via z.lazy),
// additionalProperties-as-value-schema (records).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(here, "..", "docs", "generated", "tunarr-latest-openapi.json");
const TOOLMAP_PATH = join(here, "openapi-tool-map.json");
const OUT_PATH = join(here, "..", "src", "generated", "tool-schemas.ts");

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const toolMap = JSON.parse(readFileSync(TOOLMAP_PATH, "utf8"));
const components = spec.components?.schemas ?? {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REF_RE = /^#\/components\/schemas\/(.+)$/;
const resolveName = (ref) => {
  const m = REF_RE.exec(ref ?? "");
  return m ? m[1] : null;
};

const jsonKey = (key) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);

const jsonVal = (v) => JSON.stringify(v);

// Apply `nullable` and `default` (in that order) to a base Zod expression.
const applyNullableDefault = (schema, base) => {
  if (schema.nullable) base += ".nullable()";
  if (schema.default !== undefined) base += `.default(${jsonVal(schema.default)})`;
  return base;
};

// ---------------------------------------------------------------------------
// Schema -> Zod TypeScript expression
// ---------------------------------------------------------------------------

// `coercions` maps a top-level body property name to a coercion rule.
function gen(schema, ctx = {}) {
  if (!schema || typeof schema !== "object") return "z.unknown()";

  // $ref -> named lazy const (handles recursion & cross-component refs).
  if (schema.$ref) {
    const name = resolveName(schema.$ref);
    if (!name) return "z.unknown()";
    return `z.lazy(() => ${name}Schema)`;
  }

  // oneOf / anyOf -> union.
  if (schema.oneOf)
    return applyNullableDefault(schema, `z.union([${schema.oneOf.map((m) => gen(m, ctx)).join(", ")}])`);
  if (schema.anyOf)
    return applyNullableDefault(schema, `z.union([${schema.anyOf.map((m) => gen(m, ctx)).join(", ")}])`);

  // allOf -> intersection. Single-member allOf is just a wrapper; unwrap it.
  if (schema.allOf) {
    if (schema.allOf.length === 1) return gen(schema.allOf[0], ctx);
    return applyNullableDefault(schema, `z.allOf([${schema.allOf.map((m) => gen(m, ctx)).join(", ")}])`);
  }

  // enum.
  if (schema.enum) return genEnum(schema);

  // array.
  if (schema.type === "array" || schema.items) {
    const item = schema.items ? gen(schema.items, ctx) : "z.unknown()";
    return applyNullableDefault(schema, `z.array(${item})`);
  }

  // record (additionalProperties is a value schema).
  if (
    (schema.type === "object" || schema.properties === undefined) &&
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    // Zod v4 record: z.record(keyType, valueType).
    return `z.record(z.string(), ${gen(schema.additionalProperties, ctx)})`;
  }

  // object with properties.
  if (schema.type === "object" || schema.properties) return genObject(schema, ctx);

  // scalar.
  return genScalar(schema);
}

function genEnum(schema) {
  const values = schema.enum.filter((v) => v !== null);
  let code;
  if (values.length === 1) {
    code = `z.literal(${jsonVal(values[0])})`;
  } else if (values.length > 0 && values.every((v) => typeof v === "string")) {
    code = `z.enum([${values.map((v) => jsonVal(v)).join(", ")}])`;
  } else {
    code = `z.union([${values.map((v) => `z.literal(${jsonVal(v)})`).join(", ")}])`;
  }
  return applyNullableDefault(schema, code);
}

function genScalar(schema) {
  let code;
  switch (schema.type) {
    case "string":
      code = "z.string()";
      break;
    case "boolean":
      code = "z.boolean()";
      break;
    case "integer":
      code = "z.number().int()";
      break;
    case "number":
      code = "z.number()";
      break;
    default:
      code = "z.unknown()";
  }
  if (schema.type === "number" || schema.type === "integer") {
    if (typeof schema.minimum === "number") code += `.min(${schema.minimum})`;
    if (typeof schema.maximum === "number") code += `.max(${schema.maximum})`;
  }
  return code;
}

function genObject(schema, ctx) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(props).map(([name, ps]) => {
    const isRequired = required.has(name);
    const coerceRule = ctx.coercions && ctx.coercions[name];
    let fieldCode;
    if (coerceRule) {
      fieldCode = applyCoercion(coerceRule, ps);
    } else {
      fieldCode = field(ps, isRequired);
    }
    return `      ${jsonKey(name)}: ${fieldCode}`;
  });

  let code = `z.object({\n${entries.join(",\n")}\n    })`;
  code += ".strict()";
  if (schema.nullable) code += ".nullable()";
  return code;
}

// Build a single property's Zod expression, honoring required-ness and default.
function field(schema, isRequired) {
  let code = gen(schema);
  const hasDefault = schema.default !== undefined;
  if (!hasDefault && !isRequired) code += ".optional()";
  return code;
}

// stringToObject: if the incoming value is a string, wrap it into an object
// keyed by `keys` (all set to the string). Otherwise pass it straight through
// to the inner schema. Emits a z.preprocess(...) wrapper.
function applyCoercion(rule, propSchema) {
  if (rule.type === "stringToObject") {
    const keys = rule.keys;
    const lines = keys.map((k) => `        ${jsonKey(k)}: v`);
    return `z.preprocess(\n      (v) => typeof v === "string" ? ({\n${lines.join(",\n")}\n      }) : v,\n      ${field(propSchema, true)}\n    )`;
  }
  throw new Error(`Unsupported coercion rule type: ${rule.type}`);
}

// ---------------------------------------------------------------------------
// Reachability: collect every component schema referenced (transitively) by
// the tool body schemas, so only what's needed is emitted.
// ---------------------------------------------------------------------------

const referenced = new Set();
function collectRefsRecursive(schema, out) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    const name = resolveName(schema.$ref);
    if (name) out.add(name);
  }
  if (schema.properties) Object.values(schema.properties).forEach((s) => collectRefsRecursive(s, out));
  if (schema.items) collectRefsRecursive(schema.items, out);
  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (schema[key]) schema[key].forEach((s) => collectRefsRecursive(s, out));
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    collectRefsRecursive(schema.additionalProperties, out);
  }
}
function collectRefs(schema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    const name = resolveName(schema.$ref);
    if (name) referenced.add(name);
  }
  if (schema.properties) Object.values(schema.properties).forEach(collectRefs);
  if (schema.items) collectRefs(schema.items);
  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (schema[key]) schema[key].forEach(collectRefs);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    collectRefs(schema.additionalProperties);
  }
}

const roots = toolMap.tools.map((t) => {
  const op = spec.paths[t.path]?.[t.method.toLowerCase()];
  const body = op?.requestBody?.content?.["application/json"]?.schema;
  if (!body) throw new Error(`No request body schema for tool ${t.name} (${t.method} ${t.path})`);
  return { tool: t, body };
});

for (const { body } of roots) collectRefs(body);

let changed = true;
while (changed) {
  changed = false;
  const snapshot = new Set(referenced);
  for (const name of snapshot) {
    if (components[name]) collectRefs(components[name]);
  }
  if (referenced.size > snapshot.size) changed = true;
}

// ---------------------------------------------------------------------------
// A component is recursive if it (transitively) references itself. Recursive
// `const`s need an explicit type annotation or TS reports TS7022/TS7024 via the
// z.lazy initializer. Annotate them as z.ZodType<unknown>; they validate at
// runtime and the MCP layer passes bodies through as Record<string, unknown>.
const recursive = new Set();
for (const name of referenced) {
  const refs = new Set();
  collectRefsRecursive(components[name], refs);
  if (refs.has(name)) recursive.add(name);
}

// Emit
// ---------------------------------------------------------------------------

const out = [];
out.push("// Auto-generated by scripts/openapi-to-zod.mjs — do not edit by hand.");
out.push("// Regenerate with: node scripts/openapi-to-zod.mjs  (run automatically via npm run build)");
out.push('import { z } from "zod";');
out.push("");
out.push("// ─── Component schemas ────────────────────────────────────────────────");
for (const name of referenced) {
  const ann = recursive.has(name) ? ": z.ZodType<unknown>" : "";
  out.push(`export const ${name}Schema${ann} = ${gen(components[name])};`);
}
out.push("");
out.push("// ─── Tool body schemas ────────────────────────────────────────────────");
for (const { tool, body } of roots) {
  const varName = `${tool.name}BodySchema`;
  if (tool.coercions) {
    out.push(`export const ${varName} = ${gen(body, { coercions: tool.coercions })};`);
  } else {
    out.push(`export const ${varName} = ${gen(body)};`);
  }
}
out.push("");

mkdirSync(join(here, "..", "src", "generated"), { recursive: true });
writeFileSync(OUT_PATH, out.join("\n"), "utf8");
console.log(`Wrote ${OUT_PATH}`);
console.log(`  component schemas: ${referenced.size}`);
console.log(`  tool body schemas: ${roots.length}`);
