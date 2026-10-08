# Updating installed workflows

Project and user copies take precedence over bundled workflows. Diagnostics compare the entire parsed workflow policy and SHA-256 contents of templates/includes and other assets, even when version stays unchanged. A diagnostic never changes precedence or overwrites a customization.

Preview the effective installed copy:

```sh
playspec workflow update mono-spec
playspec workflow update mono-spec --apply
```

New preset installations record `.playspec-baseline.json`. Files unchanged since that baseline can update safely. Legacy installations without a baseline treat any divergent file as customized. A conflict aborts the entire apply before runtime writes. After reviewing each difference, explicitly list accepted replacements:

```sh
playspec workflow update mono-spec --apply --accept-customized workflow.yaml templates/tech_spec_validate.md
```

Use `--source project` or `--source user` to select an installed copy hidden by another. Unknown accepted paths are rejected. No files are deleted; local extra assets remain. Every changed existing asset is backed up beneath `.playspec-updates/<run>/before/`; `report.json` records the operation. Per-file replacements and the final baseline are atomic. A filesystem failure can leave a partial update; `failure.json`, backups and the preview support deliberate recovery. Pause task execution while applying workflow changes. Updates serialize with other updates, but do not hold every task's execution lock. Active tasks in this workspace block removal of their current phase. A shared user installation can affect other workspaces, so inspect their active tasks before updating it.

Validation checks verify syntax, routing and referenced phase templates; they do not prove that new prompts preserve all custom business requirements. Review conflicts before naming their paths.

To upgrade just validation policy while retaining unrelated custom authoring prompts, use `--files workflow.yaml templates/tech_spec_validate.md templates/implementation_plan_validate.md`. Conflict acceptance applies only to selected files. Unselected baseline entries and runtime files are preserved; their drift remains visible in later full previews.
