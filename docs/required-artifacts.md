# Required deliverables

`phases.<id>.requiredOutputs` declares workspace-relative path templates that must be nonempty regular files before that phase can complete. Final `artifacts.<role>.required: true` applies the same rule before the terminal transition. Paths and symlinks must stay within the canonical workspace. Checks run before snapshots, events or task mutations.

Existing `outputs` remain informational. Artifacts without `required: true` remain optional. This preserves custom workflow compatibility and optional issue body rewrites. Built-in mono-spec, total-plan and issue validation require their documented final deliverables. Configure `requiredOutputs` for intermediate milestones when their creation must be enforced independently.

```yaml
phases:
  draft:
    title: Draft
    template: draft.md
    requiredOutputs: ["{{SPEC_FILE}}"]
artifacts:
  spec:
    path: "{{SPEC_FILE}}"
    required: true
```
