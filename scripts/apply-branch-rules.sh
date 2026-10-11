#!/usr/bin/env bash
# Apply the main-branch ruleset to a repo via the GitHub REST API.
# Usage: scripts/apply-branch-rules.sh <owner>/<repo> [governance-bot-app-id]
#
# The optional app id adds the governance bot as a bypass actor for the
# pull_request rule ONLY. That is what lets auto-tier PRs merge without a human
# while human/regulated tiers still require a CODEOWNERS approval. Without it,
# every PR needs a person — fine for the first demo, wrong for the story.
set -euo pipefail

REPO="${1:?owner/repo required}"
APP_ID="${2:-}"
RULESET=".github/rulesets/main-protection.json"

payload="$(cat "$RULESET")"
if [[ -n "$APP_ID" ]]; then
  payload="$(jq --argjson id "$APP_ID" '.bypass_actors = [{"actor_id": $id, "actor_type": "Integration", "bypass_mode": "pull_request"}]' <<<"$payload")"
fi

existing="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main — fragments governance") | .id' || true)"
if [[ -n "$existing" ]]; then
  echo "Updating ruleset $existing on $REPO"
  gh api -X PUT "repos/$REPO/rulesets/$existing" --input - <<<"$payload" >/dev/null
else
  echo "Creating ruleset on $REPO"
  gh api -X POST "repos/$REPO/rulesets" --input - <<<"$payload" >/dev/null
fi
echo "Done. Required checks: schema, brand-lint, classify. Code-owner review required."
