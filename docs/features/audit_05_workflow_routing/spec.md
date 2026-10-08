# Reject invalid workflow routes

## Problem

A non-gated phase with next: typo_phase loads successfully and completes the entire task because PhaseNotFoundError is treated as normal termination.

## Contract and implementation

WorkflowLoader validates nonempty unique phaseOrder, every next and result mapping reference, mapping coverage and keys, and feedback references across all defined phases. Explicitly terminated or last ordered phases end normally; a missing route target throws instead of becoming completion. WorkflowEditor uses the same checks, so removing an incoming route target fails before write.

## Acceptance and regression coverage

Reject missing next targets, missing/extra result mappings, empty/duplicate order and references outside order; accept valid loops and next:null. A malformed workflow must leave task state and completion ledger untouched.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
