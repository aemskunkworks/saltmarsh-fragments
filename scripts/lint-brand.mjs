#!/usr/bin/env node
// Deterministic brand + MLR lint. Reads brand/glossary.md and brand/references.md.
// This pass may FAIL the build; the LLM conformance pass may not.
//
// Checks on HCP-facing fields: forbidden terms, forbidden claims, named competitors,
// exclamation points. Structural checks: safety statement exists and matches claim
// type; every reference id exists; claim-type reference rules; every dataPoint's
// reference is cited; every number in claimText appears in dataPoints (efficacy/safety).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const glossary = parseGlossary(readFileSync(join(ROOT, "brand/glossary.md"), "utf8"));
const refs = parseReferences(readFileSync(join(ROOT, "brand/references.md"), "utf8"));
const files = process.argv.slice(2);
if (!files.length) { console.error("usage: lint-brand.mjs <fragment.json>..."); process.exit(2); }

const REF_RULES = {
  efficacy: (ids) => ids.some((id) => refs.get(id)?.type === "pivotal-trial") || "efficacy claim must cite a pivotal-trial reference",
  safety: (ids) => ids.some((id) => ["REF-003", "REF-004"].includes(id)) || "safety claim must cite REF-003 or REF-004",
  mechanism: (ids) => ids.includes("REF-007") || "mechanism claim must cite REF-007",
  "access-support": (ids) => ids.includes("REF-008") || "access-support claim must cite REF-008",
};

let failures = 0;
for (const file of files) {
  const doc = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
  const schema = JSON.parse(readFileSync(join(ROOT, "models", `${doc.model}.schema.json`), "utf8"));
  const hcpFacing = hcpFacingFields(schema);
  const problems = [];
  const c = doc.content;

  // --- copy checks on HCP-facing fields ---
  for (const [path, value] of walkStrings(c, "content")) {
    const field = path.split(".")[1].replace(/\[\d+\]$/, "");
    if (!hcpFacing.has(field)) continue;
    for (const { use, never } of glossary.terms)
      for (const bad of never) if (wordMatch(value, bad)) problems.push(`${path}: "${bad}" → use "${use}"`);
    for (const claim of glossary.forbiddenClaims)
      if (wordMatch(value, claim)) problems.push(`${path}: forbidden claim "${claim}"`);
    for (const comp of glossary.forbiddenComparators)
      if (wordMatch(value, comp)) problems.push(`${path}: named competitor "${comp}"`);
    if (/!/.test(value)) problems.push(`${path}: exclamation point`);
  }

  // --- safety statement ---
  const ss = glossary.safetyStatements.get(c.safetyStatementId);
  if (!ss) problems.push(`content.safetyStatementId: unknown "${c.safetyStatementId}"`);
  else if (!ss.requiredFor.includes(doc.scope.claimType))
    problems.push(`content.safetyStatementId: "${c.safetyStatementId}" is not the required statement for claimType "${doc.scope.claimType}" (required for: ${ss.requiredFor.join(", ")})`);
  if (c.fairBalanceText && c.fairBalanceText.trim() !== glossary.fairBalance.trim())
    problems.push(`content.fairBalanceText: must be verbatim fair-balance-standard from glossary`);

  // --- references ---
  for (const id of c.referenceIds ?? []) if (!refs.has(id)) problems.push(`content.referenceIds: unknown reference "${id}"`);
  const rule = REF_RULES[doc.scope.claimType];
  if (rule) { const r = rule(c.referenceIds ?? []); if (r !== true) problems.push(`content.referenceIds: ${r}`); }
  for (const [i, dp] of (c.dataPoints ?? []).entries())
    if (!c.referenceIds?.includes(dp.referenceId)) problems.push(`content.dataPoints[${i}]: referenceId "${dp.referenceId}" not in content.referenceIds`);

  // --- every figure in claimText must be a dataPoint ---
  if (["efficacy", "safety"].includes(doc.scope.claimType)) {
    const figures = c.claimText.match(/\d+(?:\.\d+)?%/g) ?? [];
    const dpValues = new Set((c.dataPoints ?? []).map((d) => d.value));
    for (const f of figures) if (!dpValues.has(f)) problems.push(`content.claimText: figure "${f}" has no matching dataPoints[].value`);
  }

  if (problems.length) { failures++; console.error(`✗ ${file}`); problems.forEach((p) => console.error(`    ${p}`)); }
  else console.log(`✓ ${file} (brand+MLR lint, glossary ${glossary.version}, references ${refs.version})`);
}
process.exit(failures ? 1 : 0);

// ---------- helpers ----------
function parseGlossary(md) {
  const version = /^version:\s*(.+)$/m.exec(md)?.[1]?.trim() ?? "unknown";
  const section = (h) => md.split(`## ${h}`)[1]?.split(/\n## /)[0] ?? "";
  const terms = [];
  for (const m of section("Preferred terms").matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)) {
    if (/^-+$/.test(m[1].trim()) || m[1].trim() === "Use") continue;
    terms.push({ use: m[1].trim(), never: m[2].split(",").map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean) });
  }
  const forbiddenClaims = [...section("Forbidden claims").matchAll(/^- "([^"]+)"/gm)].map((x) => x[1]);
  const forbiddenComparators = [...section("Forbidden comparators").matchAll(/^- (\S.*)$/gm)].map((x) => x[1].trim());
  const safetyStatements = new Map();
  for (const d of section("Required safety statements").matchAll(/^### ([a-z0-9-]+)\s+\(required for:\s*([^)]+)\)\n([^\n#]+)/gm))
    safetyStatements.set(d[1], { requiredFor: d[2].split(",").map((s) => s.trim()), text: d[3].trim() });
  const fairBalance = /### fair-balance-standard\n([^\n#]+)/.exec(section("Fair balance"))?.[1] ?? "";
  return { version, terms, forbiddenClaims, forbiddenComparators, safetyStatements, fairBalance };
}
function parseReferences(md) {
  const version = /^version:\s*(.+)$/m.exec(md)?.[1]?.trim() ?? "unknown";
  const map = new Map();
  for (const m of md.matchAll(/^\|\s*(REF-\d{3,4})\s*\|\s*([^|]+?)\s*\|/gm)) map.set(m[1], { type: m[2].trim() });
  map.version = version;
  return map;
}
function hcpFacingFields(schema) {
  const out = new Set();
  for (const [name, def] of Object.entries(schema.properties.content.properties)) {
    const ch = def["x-channel"] ?? [];
    if (ch.some((c) => c !== "msl-assist")) out.add(name);
  }
  return out;
}
function* walkStrings(obj, prefix) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = `${prefix}.${k}`;
    if (typeof v === "string") yield [p, v];
    else if (Array.isArray(v)) for (const [i, s] of v.entries()) { if (typeof s === "string") yield [`${p}[${i}]`, s]; else if (s && typeof s === "object") yield* walkStrings(s, `${p}[${i}]`); }
    else if (v && typeof v === "object") yield* walkStrings(v, p);
  }
}
function wordMatch(text, term) {
  const re = new RegExp(`(^|[^\\w-])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\w-])`, "i");
  return re.test(text);
}
