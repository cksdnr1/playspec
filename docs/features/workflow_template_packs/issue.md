# GitHub Issue #30: workflow_template_packs

Source: https://github.com/cksdnr1/playspec/issues/30

Implement workflow/template packs as first-class runtime assets and declarative
variable defaults while preserving backward compatibility.

Acceptance criteria:

- Validate and install workflow/template packs outside project `.playspec`.
- Create tasks with `--pack <packId>`.
- Render prompts using workflow/template assets from an installed pack.
- Allow custom packs to define new variables such as `TECH_SPEC_FILE` without
  TypeScript changes.
- Fail clearly for unresolved declared required variables.
- Keep existing default workflows rendering for old tasks.
- Keep `TOTAL_SPEC_FILE` and `PHASE_PLAN_FILE` compatibility until artifact
  declarations replace legacy behavior.
- Provide `playspec pack export` for a shareable archive installable elsewhere.

Implementation guidance:

- Add a `playspec-pack.yaml` manifest with schema, identity, variables,
  workflows, templates, and rules metadata.
- Add pack schema, registry, installer, and CLI command support.
- Store installed user packs under an OS user data directory, outside project
  `.playspec`.
- Layer variables as engine built-ins, pack defaults, workflow defaults, phase
  defaults, task variables, and future CLI overrides.
- Use deterministic Handlebars-style defaults only; no shell or JavaScript.
- Add a `workflowPack` task reference, falling back to the default compatibility
  pack for old tasks.
- Resolve templates and includes from pack roots while retaining `.playspec`
  compatibility.
- Prefer workflow artifact declarations for phase-execution linking, with
  legacy formulas as fallback.
