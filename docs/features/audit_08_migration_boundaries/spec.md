# Constrain migration paths and automatic mutations

## Problem

Migration plans can write ../ paths, override arbitrary workspace metadata, auto-apply high-risk operations by claiming requiresReview:false, and continue after mandatory backup failures.

## Contract and implementation

Validate plan/operation IDs and workspace-relative targets; resolve canonical containment immediately before every read/write/archive. Raw file mutation is allow-listed to docs/, .playspec/templates/ and .playspec/rules/; structured task changes must target the declared task.yaml. Auto mode permits only low-risk, explicitly deterministic structured state promotions without outstanding review requirements. Other actions are skipped with a report; review mode remains available. Existing raw files are backed up even if a plan disables backup; ignore only ENOENT for new files, fail on all other backup errors. Writes are atomic. Validate context references and state phase targets before mutation.

## Acceptance and regression coverage

Reject traversal, absolute and external symlink targets and unsafe plan IDs. Reject raw task-state mutation. High-risk auto actions cannot execute; deterministic low-risk promotions can. Inject a backup error and verify target unchanged. Existing review/dry-run/archive tests must remain meaningful under the tightened policy.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
