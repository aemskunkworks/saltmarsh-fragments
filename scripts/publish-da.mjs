#!/usr/bin/env node
// STUB — publish merged fragments to DA.live as sheets, then preview.
//
// Design (option 3: Git is the origin, DA is a delivery surface):
//   1. For each model, build one multi-sheet JSON: sheet name = model,
//      one row per fragment, columns = flattened content.* + attributes.* + id,
//      effectiveFrom, effectiveTo. Nested memberCostShare flattens to
//      memberCostShare.type / memberCostShare.copayAmountUsd / ...
//   2. Skip fragments whose effectiveFrom is in the future (publish scheduling
//      is roadmap; for now they simply don't ship until the date passes and a
//      later run picks them up).
//   3. PUT the sheet to DA source API:
//        POST https://admin.da.live/source/{org}/{repo}/fragments/{model}.json
//      with IMS bearer token (DA_IMS_TOKEN secret). Body: multipart "data".
//   4. Preview via AEM admin API:
//        POST https://admin.hlx.page/preview/{org}/{repo}/main/fragments/{model}.json
//      Publish (aem.live) stays a HUMAN or scheduled action, not this script.
//
// Env: DA_ORG, DA_REPO, DA_IMS_TOKEN
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const today = new Date().toISOString().slice(0, 10);

for (const model of readdirSync(join(ROOT, "fragments"))) {
  const rows = [];
  for (const f of readdirSync(join(ROOT, "fragments", model)).filter((f) => f.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(join(ROOT, "fragments", model, f), "utf8"));
    if (doc.effectiveFrom > today) { console.log(`  skip ${doc.id} (effectiveFrom ${doc.effectiveFrom} > today)`); continue; }
    if (doc.effectiveTo && doc.effectiveTo < today) { console.log(`  skip ${doc.id} (expired)`); continue; }
    rows.push(flatten({ id: doc.id, effectiveFrom: doc.effectiveFrom, effectiveTo: doc.effectiveTo, ...doc.content, attributes: doc.attributes }));
  }
  const sheet = { total: rows.length, offset: 0, limit: rows.length, data: rows, ":type": "sheet" };
  console.log(`[dry-run] would PUT /source/${process.env.DA_ORG ?? "{org}"}/${process.env.DA_REPO ?? "{repo}"}/fragments/${model}.json with ${rows.length} rows`);
  if (process.env.PUBLISH_DEBUG) console.log(JSON.stringify(sheet, null, 2));
}
console.log("publish-da: stub — dry run only. Set DA_IMS_TOKEN and remove the dry-run guard to go live.");

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join(" | ") : v ?? "";
  }
  return out;
}
