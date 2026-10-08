# Enforce required workflow artifacts

## Problem

Completion accepts missing or empty deliverables and can mark a task done without its documented outputs.

## Contract and implementation

Introduce explicit requiredOutputs on phases and required on final artifact declarations. Validate nonempty regular files within the canonical workspace before completion writes. Legacy informational outputs and optional artifacts remain compatible. Built-in feature workflows require their final spec, plan, result and PR deliverables; issue body updates stay optional. Phase authors can opt in independently.

## Acceptance and regression coverage

Missing, empty, directory and external symlink outputs reject before ledger/state changes. Nonempty files pass. Optional artifacts remain optional and final requirements run only on terminal transitions.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
