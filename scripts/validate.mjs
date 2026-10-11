#!/usr/bin/env node
// Schema validation for every fragment under fragments/<model>/*.json.
// Exit 1 on any failure. Also enforces: filename == id, model dir == model field.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = new URL("..", import.meta.url).pathname;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const schemas = {};
for (const f of readdirSync(join(ROOT, "models")).filter((f) => f.endsWith(".schema.json"))) {
  const schema = JSON.parse(readFileSync(join(ROOT, "models", f), "utf8"));
  schemas[f.replace(".schema.json", "")] = ajv.compile(schema);
}

const targets = process.argv.slice(2);
const files = targets.length ? targets : listFragments();
let failures = 0;

for (const file of files) {
  const model = basename(join(file, ".."));
  const validate = schemas[model];
  if (!validate) { report(file, [`no schema for model directory "${model}"`]); failures++; continue; }
  let doc;
  try { doc = JSON.parse(readFileSync(join(ROOT, file), "utf8")); }
  catch (e) { report(file, [`invalid JSON: ${e.message}`]); failures++; continue; }

  const errs = [];
  if (!validate(doc)) errs.push(...validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`));
  if (doc.id !== basename(file, ".json")) errs.push(`id "${doc.id}" != filename "${basename(file, ".json")}"`);
  if (doc.model !== model) errs.push(`model "${doc.model}" != directory "${model}"`);
  if (errs.length) { report(file, errs); failures++; } else console.log(`✓ ${file}`);
}

process.exit(failures ? 1 : 0);

function listFragments() {
  const out = [];
  for (const model of readdirSync(join(ROOT, "fragments"))) {
    const dir = join(ROOT, "fragments", model);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".json")) out.push(`fragments/${model}/${f}`);
  }
  return out;
}
function report(file, errs) { console.error(`✗ ${file}`); for (const e of errs) console.error(`    ${e}`); }
