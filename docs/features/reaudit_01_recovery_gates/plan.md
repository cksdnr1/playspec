# Implementation plan

Share validation prerequisite policy; invoke it in completion/recovery and migration; add bypass and valid progression regressions; run built-in workflow and routing tests.

## Acceptance gate
Reject direct recovery to final phase, completion of a task created at final phase, and migration phase bypass. Allow normal approved progression and revision/revalidation. Nongated custom workflows keep recovery compatibility.

Revisit the design if failure injection exposes an inconsistent contract.
