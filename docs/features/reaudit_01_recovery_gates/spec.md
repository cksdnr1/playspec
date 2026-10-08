# Prevent recovery tools from bypassing validation gates

## Observed failure
Recovery phase changes can jump directly to final PR preparation and complete without configured spec or plan approvals.

## Contract
Require the latest approved decision with evidence for every preceding configured validation gate on both recovery and normal completion. Allow authoring/revalidation and explicit revision destinations. Validate approved inputs using retained report or immutable snapshots. Apply the same policy to structured migration phase changes; completion owns terminal state.

## Verification
Reject direct recovery to final phase, completion of a task created at final phase, and migration phase bypass. Allow normal approved progression and revision/revalidation. Nongated custom workflows keep recovery compatibility.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
