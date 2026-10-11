#!/usr/bin/env node
// STUB — recompute reputation/reputation.json from Git history + PR metadata.
// Runs in publish.yml after each merge to main.
//
// Inputs (via gh CLI / GITHUB_TOKEN):
//   - merged PRs touching fragments/**: author field from the fragment JSON,
//     source.pipeline, whether a reviewer pushed commits (reviewer edits),
//     whether the classify check passed first try, later reverts of the merge.
// Output: reputation.json with scores = Σ weight_i * rate_i.
//
// For the PoC the seeded file is enough to tell the story. Wire this up when
// you have ≥5 merged PRs so the numbers mean something.
console.log("update-reputation: stub — no-op. Seeded reputation.json left unchanged.");
