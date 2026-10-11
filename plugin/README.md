# DA.live plugin — reviewer surface (not yet built)

Registered in the DA org CONFIG sheet like the Birch Creek email library app (same registration pattern).
Reads PRs labelled `review:human` / `review:regulated` through the governance
GitHub App (via a small worker that holds the app credentials), renders the
field-level diff from `.ci/reports/*.json`, shows author + source reputation
badges, and submits an approving GitHub review carrying the attestation text
from `.github/pull_request_template.md`.
