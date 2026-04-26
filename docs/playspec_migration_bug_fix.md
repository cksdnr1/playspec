# PlaySpec Migration System Bugfix Spec

## 1. How to Read This Spec

This is a bugfix spec for the PlaySpec migration system.

- This spec does not define new features
- This spec defines corrections to invalid or unsafe migration behavior
- This spec must be implemented before further use of playspec migrate

This spec addresses issues found from:

- A generated MigrationPlan (migration_playspec_dev_history_20260426_001)
- A full review analysis of the docs/ directory
- Observed inconsistencies between docs, task state, and system behavior

---

## 2. Goal

Fix the migration system so that:

- It does not generate unsafe or invalid MigrationPlans
- It does not allow inconsistent or misleading state promotion
- It enforces strict validation before any mutation
- It guarantees reproducible, auditable migration behavior

---

## 3. Problem Summary

### 3.1 MigrationPlan Quality Issues

The generated migration plan revealed:

- State promotion with unknown actual state (currentPhase)
- ContextRef additions without task existence guarantee
- Missing handling of duplicate contextRefs
- Inclusion of non-supported operations (rename/typo handling outside system)
- Weak separation between:
  - deterministic facts
  - inferred assumptions

---

### 3.2 Document / System Inconsistencies (from review)

Critical issues found:

1. CLAUDE.md phase mismatch
   - Declares Phase 1 while system is at Phase 4.1+
   - Causes AI agents to operate under wrong constraints

2. Rollback test failures hidden
   - 3 failures from Phase 3.6 silently excluded
   - Not documented in phase plan

3. No PlaySpec self-tracking task
   - Migration depends on task existence
   - System cannot “dogfood” itself

4. Routing field ambiguity
   - Spec says “only if supported”
   - But implementation (Phase 3.7) already supports it

5. MCP migration flow incomplete
   - Spec expects MCP-driven flow
   - No MCP file-read or migration tool exists

6. Archive path conflict risk
   - .playspec/migrations/archived/ vs Phase 5 archive
   - No documented separation

7. Phase plan inconsistencies
   - Phase 1.5 duplicated with conflicting scope
   - Total spec and phase plan out of sync

---

## 4. Scope

### In Scope

- MigrationPlan validation improvements
- Migration runner safety enforcement
- State promotion guard strengthening
- contextRefs correctness and deduplication
- Action validation tightening
- Consistency validation across:
  - docs
  - task.yaml
  - system state

---

### Out of Scope

- Manual document fixes (CLAUDE.md, typo rename)
- Archive system redesign (Phase 5)
- MCP migration tool implementation
- Viewer / evolution / DAG / automation features
- Changing PlaySpec architecture

---

## 5. Fix Strategy

### 5.1 Validation Layers

Migration must enforce three levels of validation:

1. Schema validation
   - Zod-based structure validation

2. Semantic validation
   - action correctness
   - allowed state transitions

3. State-aware validation
   - actual task state must be known
   - inferred values must be marked and gated

---

### 5.2 Strict Separation of Fact vs Inference

MigrationPlan must distinguish:

- deterministic → safe
- high/medium/low → requires review

System must:

- Block unsafe auto-application
- Require confirmation for all non-deterministic updates

---

## 6. Required Fixes

### 6.1 Action Validation

- Reject unsupported action types at schema level
- Explicitly forbid:
  - delete_file
  - implicit rename
  - unknown actions

---

### 6.2 Task Context Validation

Before any action:

- Ensure taskId exists
- Reject actions if:
  - task not found
  - task.yaml not readable

---

### 6.3 State Promotion Guard

- update_task_state must:
  - verify actual current value from task.yaml
  - not rely on docs-only inference

- If actual value is unknown:
  - force requiresReview: true
  - block auto mode

---

### 6.4 contextRefs Handling

- Deduplicate by normalized path
- Reject:
  - absolute paths
  - escaping paths (../)
- Validate file existence before apply

---

### 6.5 MigrationPlan Integrity

MigrationPlan must:

- Include valid targetTaskId
- Include only existing source files
- Not assume missing files silently
- Flag typos explicitly (not silently skip)

---

### 6.6 Confidence Enforcement

| Level | Behavior |
|------|--------|
| deterministic | allowed (review still preferred) |
| high | review required |
| medium | review only |
| low | reject |

---

### 6.7 Execution Safety

Before ANY mutation:

- Plan must be persisted
- Report must be created
- Backup must be created

If validation fails:

- No backup
- No mutation
- Fail early

---

### 6.8 CLI vs MCP Consistency

- CLI may allow HEAD fallback (explicit)
- MCP must NEVER use HEAD
- Migration runner must not depend on CLI fallback

---

## 7. Known External Issues (Not Fixed Here)

These are documented but NOT solved in this spec:

- CLAUDE.md phase mismatch
- docs filename typo (playsepc)
- rollback test failures
- archive system conflict
- MCP migration tooling gap

These require:

- manual fixes
- or future phase work

---

## 8. Acceptance Criteria

Migration system is considered fixed when:

- Invalid MigrationPlan cannot pass validation
- Unknown state promotion is blocked or forced to review
- contextRefs duplication is prevented
- task.yaml is never mutated without:
  - validation
  - preview
  - backup
- dry-run produces identical plan with zero mutation
- auto mode never applies ambiguous changes
- unsupported actions are rejected immediately

---

## 9. Non-Goals

This spec does NOT:

- Fix existing docs automatically
- Replace migration with spec-driven patching
- Introduce new migration features
- Change phase plan structure

---

## 10. One-line Conclusion

The migration system must shift from “best-effort inference”  
to “strict, validated, state-aware transformation”.