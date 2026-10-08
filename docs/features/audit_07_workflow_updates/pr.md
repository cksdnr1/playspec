Installed workflow copies can shadow updated validation prompts and gate policies while keeping the same version. Compare the full parsed policy and asset content hashes, and provide explicit preview/apply updates with baseline tracking, selected-file updates, per-path conflict acceptance and backups. Existing custom files remain selected and usable until explicitly replaced; no files are deleted.

New preset installs record shipped baselines. Updates reject incompatible active phases before replacing assets, serialize updates, write atomic files and retain recovery reports. Shared user workflows still require the operator to account for other workspaces and pause execution during application; per-file atomicity does not make a multi-file update transactional.

Validation: TypeScript build; complete suite: 43 files and 756 tests passed, including 212 CLI tests and packaged installation checks. Task: `audit_07_workflow_updates`.
