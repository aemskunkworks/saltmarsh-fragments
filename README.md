# saltmarsh-fragments

Git-sourced **product-claim fragments** for Edge Delivery Services / DA.live.
**Git is the origin; DA is a delivery surface.** Every fragment is one
MLR-reviewable claim as JSON, validated against a schema, reviewed through a
PR, and pushed to DA as a sheet on merge.

Fictional brand for a life sciences demo: **Saltmarsh Therapeutics**, maker of
**Tarnexa (quilvecitinib)**, an oral selective JAK1 inhibitor for adults with
moderately to severely active rheumatoid arthritis after inadequate response or
intolerance to one or more TNF inhibitors (TNF-IR). Every trial, figure,
reference and person in this repository is invented; `provenance.dataStatus`
says so on every fragment and the schema enforces it.

```
source pipeline ──► ingest.yml ──► PR (bot-authored) ──► validate-classify.yml ──► MLR review ──► merge ──► publish.yml ──► DA sheet ──► preview
 (Express add-on,                                        schema · brand-lint ·     (DA plugin
  Figma, CC Libs)                                        classify (diff → tier)     or GitHub)
```

## Layout

| Path | What | Review tier to change it |
|---|---|---|
| `models/product-claim.schema.json` | JSON Schema for a claim: `scope` (indication, population, claim type, comparator), `content` (claimText, references, structured dataPoints, safety statement, fair balance, CTA, MSL notes, KOL quote), `attributes` (Q-matrix row + evidence-ladder rung). Field-level `x-review`, `x-channel`, `x-pii`. | human |
| `models/attributes.json` | Audience of One attribute registry. | human |
| `fragments/product-claim/<id>.json` | One claim per file. Filename == `id`. Two examples: an efficacy claim (ESTUARY-1 ACR20/50) and an access-support claim. | per classifier |
| `brand/glossary.md` | **Locked.** Preferred terms, forbidden claims, forbidden named competitors, required safety statements per claim type, verbatim fair balance. | regulated |
| `brand/references.md` | **Locked.** The approved (fictional) reference library and the claim-type → reference rules. | regulated |
| `brand/brand-profile.json` | **Locked.** Stardust-shaped brand audit output. | regulated |
| `reputation/reputation.json` | Machine-written author + source-pipeline reputation; raise-only input to the classifier. | bot only |
| `scripts/` | `validate`, `lint-brand`, `classify` run for real; `publish-da`, `update-reputation` are stubs. | platform |
| `plugin/` | DA.live plugin, the reviewer surface. Not yet built. | platform |

## Review tiers — how a PR is classified

1. **Semantic diff** (`scripts/classify.mjs`): compare the PR's fragment to `main`'s field by field per the schema. Arrays of objects (`dataPoints`) diff per item, so a reviewer sees `58% → 61%`, not a blob.
2. **Field tier** = max `x-review` of every changed field. A new fragment counts every field as changed.
3. **Raise-only adjustments**: cold-start or low-score author/source → at least `human`. The optional LLM conformance pass may raise, never lower. Nothing lowers below the field tier.
4. `auto` → auto-merge on green checks. `human`/`regulated` → CODEOWNERS approval with the MLR attestation in the PR template.

Deterministic checks (`schema`, `brand-lint`) **fail** the build. The LLM pass is advisory.

### What brand-lint enforces (all deterministic)

- Preferred terminology and forbidden claims (`proven`, `superior`, `cure`, `safe`, …) in HCP-facing fields
- No named marketed competitor anywhere HCP-facing
- `safetyStatementId` exists and is the one required for the claim type
- `fairBalanceText` is verbatim from the glossary when present
- Every `referenceIds` entry exists in the reference library; claim-type rules (efficacy → pivotal trial, safety → PI or pooled safety, mechanism → REF-007, access → REF-008)
- Every `dataPoints[].referenceId` is cited; every percentage in `claimText` has a matching `dataPoints[].value`

## Local

```bash
npm ci
npm run check
node scripts/classify.mjs fragments/product-claim/acr20-week24-tnf-ir.json --base none
node scripts/publish-da.mjs        # dry run
```

Scenarios verified locally:

| Change | Result |
|---|---|
| `headline` edit, trusted author + source | **AUTO** |
| ACR20 58% → 61% in `claimText` and `dataPoints` | **REGULATED**, with `dataPoints[0].value 58% → 61%` on the diff |
| ACR20 changed in `claimText` only | brand-lint **fails**: figure has no matching dataPoint |
| `headline` edit by cold-start author via `manual` | **HUMAN** (raised, both reasons listed) |
| "proven superior to Rinvoq for RA patients" + wrong safety statement | brand-lint **fails** with five exact violations |
| Efficacy claim citing only the PI | brand-lint **fails**: needs a pivotal-trial reference |

## Setup on GitHub (personal account, no GitHub App)

1. Repo must be **public** for branch rulesets on a personal account (data is fictional).
2. Add `lisamarie-13` as a collaborator (the reviewer); `aemskunkworks` owns the repo and authors PRs.
3. Create a fine-grained PAT on `aemskunkworks` with Contents + Pull requests read/write on this repo; store it as the secret `GOVERNANCE_APP_TOKEN`. The ingest workflow uses it so merges trigger `publish.yml` (pushes made with the default `GITHUB_TOKEN` don't trigger workflows).
4. Repo settings → General → **Allow auto-merge**.
5. `scripts/apply-branch-rules.sh aemskunkworks/saltmarsh-fragments` → required checks `schema`, `brand-lint`, `classify`, `gate`; no review rule (the `gate` check enforces approval for human/regulated tiers).
6. Variables `DA_ORG=aemskunkworks`, `DA_REPO=tarnexa-demo`; secret `DA_IMS_TOKEN` when you wire publishing.

## Identity

`author` is the IMS user ID, 1:1 passthrough for the PoC, stored **only** in the fragment's `author` field, never in commit metadata, PR titles or trailers. Swapping it for an HMAC pseudonym later is a one-line change in `ingest.yml`.

## Roadmap (deliberately out of the PoC)

- Field-level approval; second reviewer group / dual sign-off (legal + medical)
- Pseudonymized author IDs
- LLM brand-profile conformance pass wired to Stardust (checks `lede`/`headline` don't add results beyond `claimText`)
- Reference-library versioning and PI-change impact analysis (which fragments cite a changed section)
- Localization variants, cross-fragment references, publish scheduling
- `update-reputation.mjs` computing from real PR history
- Audience of One: LCDM over the `attributes` block, `evidenceDepth` as the polytomous item
