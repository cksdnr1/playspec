# Contract and final code review

This is a single-reviewer review; no claim of a separate model, erased memory or measured human usability is made.

The existing stores are the authority for proposal replacement and path validation. The MCP schema reuses those validators and makes only server-managed update metadata optional. A real client test verifies evidenceRefs are retained when omitted and revision increments after evidence append. Allowed target roots are exported from the runner and reused in descriptions, avoiding a parallel allowlist.

Counterexamples checked during implementation:

- An external workflow can be validated without being installed: follow-up now lists installed workflows instead of suggesting a same-ID installed definition that may be absent or different.
- A generated advisory proposal cannot be diffed: guidance now explains explicit refinement and offers inspection, not an unusable diff.
- An unbound session cannot execute status: guidance now offers task discovery.
- An update that omits evidence must preserve it: the schema wraps defaulted fields as optional, and the stdio regression confirms preservation.
- A workflow source directory whose basename differs from definition.id is rejected: descriptions now state this prerequisite.
- Existing render errors can contain a workflow inspection call without a root: the shared adapter scopes both old and new follow-up calls.
- Render recovery and evidence collection write snapshots/evidence: neither is advertised as strictly read-only. Suggested phase inspection retains existing transaction recovery behavior.
- Removing the final task link omits the empty optional links field: tests accept the existing representation, preserving compatibility.

No mutation authorization is emitted in nextActions. Approval/confirmation gates retain enforcement and gain explicit failure codes. Workspace isolation, schema discovery and follow-up validity are tested through actual stdio transport; user-global installation/removal tests use an isolated PLAY_SPEC_USER_WORKFLOWS store. Large new lists return bounded compact pages, while storage scanning cost remains unchanged. Unknown failures remain conservative operation_failed errors, and pre-handler schema failures retain the native SDK envelope.
