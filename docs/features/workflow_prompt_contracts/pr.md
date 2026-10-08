## Why this PR

Workflow validation prompts mixed artifact read-only rules with required report writes, led with scores before findings, and reused implementation instructions in legacy analysis/review phases. The workflows now provide explicit roles, allowed outputs and evidence-first verdicts while retaining existing engine gates and the requested competing-model review framing.

## Problem

Contradictory write permissions can prevent required reports; early numeric scores encourage threshold anchoring; shared legacy templates obscure the current phase. Passing engine tests alone does not measure a model’s review quality.

## How it was fixed

- Workflow-local evaluation rules separate findings, dimension scoring and verdicts, reject artifact instructions, disclose same-agent review limits and prohibit approval with blockers.
- Mono-spec/total-plan validation permits required reports while keeping inputs read-only; global rules make checks contextual and preserve MCP completion provenance.
- Multi-spec, phase-execution and simple-bug map existing numeric phases to role-specific templates.
- `evals/workflow-prompts/harness.ts` and `scripts/eval-workflow-prompts.ts` export real bundled prompts without expected answers and grade eight artificial cases, including valid controls. No provider dependency or model configuration changes.

## Validation

Build, eval-tool typecheck, 87 focused tests, compiled MCP render (48 tools), eight-case export and diff check passed. Full regression: 56 files / 816 tests passed. Installed copies were previewed; historical baseline conflicts were verified against exact Git file bytes before any explicit replacement.

## Risks / follow-ups

No live external-model evaluation was run; synthetic fixture responses validate the grader only. The grader checks bounded evidence and gate contracts, not semantic understanding or truthful provenance. Ungated phases use explicit stop instructions without runtime gate changes. Installed workflow rollout uses supported updater backups and preserves actual customizations. Reconnect clients after rebuilding main; no init overwrite is needed.
