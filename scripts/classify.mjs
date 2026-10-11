#!/usr/bin/env node
// Diff-first, classify-second.
//
// 1. Semantic diff: compare the fragment on the PR branch to the version on
//    main, field by field, against the schema (not a text diff).
// 2. Classify: fragment tier = max(x-review of every changed field), with
//    "new fragment" = every field changed. Reputation may only RAISE the tier
//    (cold start / low reputation → bump auto→human). Nothing lowers it.
// 3. Emit a report (markdown for the PR comment) + a machine-readable JSON.
//
// Usage: classify.mjs <fragment.json> [--base <path-to-main-version|none>] [--out report.json]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TIER_RANK = { auto: 0, human: 1, regulated: 2 };
const args = process.argv.slice(2);
const file = args[0];
const baseArg = flag("--base") ?? "none";
const outPath = flag("--out");

const head = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
const base = baseArg === "none" || !existsSync(baseArg) ? null : JSON.parse(readFileSync(baseArg, "utf8"));
const schema = JSON.parse(readFileSync(join(ROOT, "models", `${head.model}.schema.json`), "utf8"));
const reputation = JSON.parse(readFileSync(join(ROOT, "reputation/reputation.json"), "utf8"));

// ---- 1. semantic diff ----
const changes = [];
for (const [path, def] of leafFields(schema)) {
  const before = base ? get(base, path) : undefined;
  const after = get(head, path);
  if (before === undefined && after === undefined) continue;
  if (base !== null && JSON.stringify(before) === JSON.stringify(after)) continue;
  const tier = def["x-review"] ?? "human";
  // Arrays of objects (e.g. dataPoints): diff per item/field so a reviewer sees 58% → 61%, not a blob.
  if (def.type === "array" && def.items?.properties && (Array.isArray(before) || Array.isArray(after))) {
    const n = Math.max(before?.length ?? 0, after?.length ?? 0);
    for (let i = 0; i < n; i++)
      for (const k of Object.keys(def.items.properties)) {
        const b = before?.[i]?.[k], a = after?.[i]?.[k];
        if (b === undefined && a === undefined) continue;
        if (base === null || JSON.stringify(b) !== JSON.stringify(a)) changes.push({ path: `${path}[${i}].${k}`, tier, before: b, after: a, pii: false });
      }
    continue;
  }
  changes.push({ path, tier, before, after, pii: !!def["x-pii"] });
}

// ---- 2. classify ----
let fieldTier = changes.reduce((t, c) => (TIER_RANK[c.tier] > TIER_RANK[t] ? c.tier : t), "auto");
if (changes.length === 0) fieldTier = "auto";
const reasons = [];
if (base === null) reasons.push("new fragment: every field counts as changed");

let tier = fieldTier;
const authorRep = reputation.authors[head.author];
const sourceRep = reputation.sources[head.source.pipeline];
const raise = (why) => { if (TIER_RANK[tier] < TIER_RANK.human) { tier = "human"; } reasons.push(why); };
if (!authorRep) raise(`author ${head.author} has no history (cold start) → raised to human`);
else if (authorRep.score < reputation.thresholds.authorAutoMin) raise(`author score ${authorRep.score} < ${reputation.thresholds.authorAutoMin} → raised to human`);
if (!sourceRep) raise(`source ${head.source.pipeline} has no history (cold start) → raised to human`);
else if (sourceRep.score < reputation.thresholds.sourceAutoMin) raise(`source score ${sourceRep.score} < ${reputation.thresholds.sourceAutoMin} → raised to human`);
if (head.source.templateId && sourceRep?.templates?.[head.source.templateId]) reasons.push(`template ${head.source.templateId} is known to this source (no effect on tier; noted for reviewer)`);

// Slot for the LLM conformance pass: it writes {raiseTo:"human", why:"..."} to
// $LLM_REVIEW_JSON; we honour raises only. It can never lower.
if (process.env.LLM_REVIEW_JSON && existsSync(process.env.LLM_REVIEW_JSON)) {
  const llm = JSON.parse(readFileSync(process.env.LLM_REVIEW_JSON, "utf8"));
  if (llm.raiseTo && TIER_RANK[llm.raiseTo] > TIER_RANK[tier]) { tier = llm.raiseTo; reasons.push(`LLM conformance: ${llm.why}`); }
  else if (llm.why) reasons.push(`LLM conformance (advisory): ${llm.why}`);
}

// ---- 3. report ----
const result = {
  fragment: head.id, model: head.model, fieldTier, tier,
  author: head.author, authorScore: authorRep?.score ?? null,
  source: head.source.pipeline, sourceScore: sourceRep?.score ?? null,
  changes: changes.map(({ path, tier, pii }) => ({ path, tier, pii })), reasons,
};
if (outPath) writeFileSync(outPath, JSON.stringify(result, null, 2));

const badge = (s) => (s == null ? "— (none)" : s >= 0.8 ? `${s.toFixed(2)} ●●●` : s >= 0.5 ? `${s.toFixed(2)} ●●○` : `${s.toFixed(2)} ●○○`);
let md = `### Review classification: **${tier.toUpperCase()}**\n\n`;
md += `| | |\n|---|---|\n| Fragment | \`${head.id}\` (${head.model}) |\n| Field tier | ${fieldTier} |\n| Final tier | **${tier}** |\n| Author | \`${head.author}\` · ${badge(authorRep?.score)} |\n| Source | \`${head.source.pipeline}\` · ${badge(sourceRep?.score)} |\n\n`;
md += `#### Changed fields (${changes.length})\n\n| Field | Tier | Before | After |\n|---|---|---|---|\n`;
for (const c of changes) md += `| \`${c.path}\` | ${c.tier} | ${cell(c.before, c.pii)} | ${cell(c.after, c.pii)} |\n`;
if (reasons.length) md += `\n#### Why\n\n${reasons.map((r) => `- ${r}`).join("\n")}\n`;
md += tier === "auto"
  ? `\n✅ Auto-tier: merges on green checks.\n`
  : `\n🛑 Requires an approving review from a code owner. Approve in the DA plugin or on GitHub with the attestation in the PR template.\n`;
console.log(md);

// ---------- helpers ----------
function flag(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }
function get(o, path) { return path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o); }
function cell(v, pii) { if (v === undefined) return "_—_"; if (pii) return "`[redacted]`"; const s = JSON.stringify(v); return s.length > 60 ? `\`${s.slice(0, 57)}…\`` : `\`${s}\``; }
function* leafFields(schema, prefix = "", inheritedTier) {
  for (const [k, def] of Object.entries(schema.properties ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    const tier = def["x-review"] ?? inheritedTier;
    if (def.type === "object" && def.properties) yield* leafFields(def, path, tier);
    else yield [path, { ...def, "x-review": tier }];
  }
}
