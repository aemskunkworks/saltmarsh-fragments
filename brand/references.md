---
version: 0.1.0
owner: mlr-review
---

# Approved reference library — FICTIONAL

Every reference below is invented for the demo. Trial names, journals, authors
and figures do not exist. `content.referenceIds` may only cite ids listed here;
lint fails on anything else. Adding a reference is a `regulated`-tier change.

| id | type | citation (fictional) | supports |
|---|---|---|---|
| REF-001 | pivotal-trial | ESTUARY-1. Phase 3, randomized, double-blind, placebo-controlled, 52 weeks, adults with moderately to severely active RA and inadequate response to ≥1 TNF inhibitor, on background csDMARD. N=612. | efficacy · ACR20/50/70 · DAS28-CRP · HAQ-DI |
| REF-002 | pivotal-trial | ESTUARY-2. Phase 3, randomized, double-blind, placebo-controlled, 24 weeks, TNF-IR adults, monotherapy arm. N=418. | efficacy · ACR20/50 · monotherapy |
| REF-003 | prescribing-information | Tarnexa (quilvecitinib) full Prescribing Information. Saltmarsh Therapeutics. | safety · dosing · boxed warning · indication |
| REF-004 | pooled-safety | Integrated safety analysis, ESTUARY-1 and -2 plus long-term extension. 1,004 patients, 1,612 patient-years. | safety · adverse reactions · exposure |
| REF-005 | subgroup | ESTUARY-1 prespecified subgroup: patients with inadequate response to ≥2 prior TNF inhibitors (n=203). | efficacy in multi-TNF-IR · clinical fit |
| REF-006 | real-world | TIDELINE registry interim analysis, 18 months, 1,280 patients initiating Tarnexa after TNF inhibitor. | persistence · real-world · switching |
| REF-007 | mechanism | Selectivity profile of quilvecitinib across JAK1/2/3 and TYK2 in cellular assays. | mechanism · selectivity |
| REF-008 | access | Saltmarsh Access Navigator program description and coverage summary, Q4 2026. | access-support · prior authorization · copay |

## Rules the lint enforces

- An `efficacy` claim must cite at least one `pivotal-trial` reference.
- A `safety` claim must cite REF-003 or REF-004.
- A `mechanism` claim must cite REF-007.
- An `access-support` claim must cite REF-008.
- Every `dataPoints[].referenceId` must appear in `content.referenceIds`.
