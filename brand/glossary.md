---
version: 0.1.0
brand: Saltmarsh Therapeutics
product: Tarnexa (quilvecitinib)
owner: mlr-review
---

# Brand glossary — deterministic layer

This file is **locked-layer**. `scripts/lint-brand.mjs` reads it and fails CI
on violations. Changing this file is itself a `regulated`-tier change. The LLM
conformance pass reads it too, but may only raise a review tier, never fail.

All product data in this repository is **fictional demo data**. Nothing here
describes a real medicine.

## Preferred terms

Use the left column. The right column is forbidden in HCP-facing fields.

| Use | Never |
|---|---|
| Tarnexa | Tarnexa® (mark is applied by the renderer), TARNEXA® |
| quilvecitinib | the molecule, the compound, our JAK |
| rheumatoid arthritis | RA (on first use in a fragment) |
| inadequate response to one or more TNF inhibitors | TNF failure, failed TNF, TNF-refractory |
| TNF inhibitor | anti-TNF, TNF blocker |
| healthcare professional | doctor, physician (unless the audience is physicians only) |
| patients | subjects (outside a trial-design context), consumers, users |
| once-daily oral | pill, once a day pill |
| adverse reactions | side effects |
| prescribing information | label, PI (on first use) |

## Forbidden claims

Any of these in an HCP-facing field fails lint.

- "cure"
- "safe" (unqualified; "safety profile" with a reference is fine, "safe and effective" is not)
- "no side effects"
- "well tolerated" (unless the field cites a reference containing tolerability data)
- "proven"
- "superior" / "superiority" (no head-to-head data exists; comparator enum forbids it)
- "best-in-class" / "first-in-class" / "breakthrough"
- "most prescribed" / "#1"
- "guaranteed"
- "off-label"
- "remission" (unless the field cites a reference reporting a remission endpoint)

## Forbidden comparators

Naming a marketed competitor in any field fails lint. The comparator enum in
the schema allows only placebo, csDMARD background, or prior-TNF context.

- Humira
- Enbrel
- Remicade
- Rinvoq
- Xeljanz
- Olumiant
- Actemra
- Orencia
- Rituxan

## Required safety statements

Each statement has an id. Fragments reference one in `content.safetyStatementId`.
Lint checks the referenced id exists and matches the claim type's requirement.

### isi-boxed-warning  (required for: efficacy, mechanism, dosing-administration)
Tarnexa carries a boxed warning for serious infections, mortality, malignancy, major adverse cardiovascular events, and thrombosis. See full Prescribing Information including Boxed Warning.

### isi-safety-claim  (required for: safety)
Adverse reactions reported in clinical trials are described in the full Prescribing Information. See full Prescribing Information including Boxed Warning.

### isi-brief  (required for: access-support, patient-identification)
See full Prescribing Information including Boxed Warning.

## Fair balance (verbatim for email / chat)

### fair-balance-standard
Tarnexa is indicated for adults with moderately to severely active rheumatoid arthritis who have had an inadequate response or intolerance to one or more TNF inhibitors. Boxed warning: serious infections, mortality, malignancy, major adverse cardiovascular events, thrombosis. See full Prescribing Information.

## Register

- Third person for the product, second person for the HCP ("your patients"). Never "we believe", "we're proud".
- Numbers: report as in the reference; percentages with no decimals unless the reference uses them. (LLM pass checks against dataPoints.)
- No exclamation points in HCP-facing fields. (Linted.)
- No superlatives without a cited reference. (LLM pass, advisory.)
