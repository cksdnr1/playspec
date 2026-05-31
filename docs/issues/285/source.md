# Issue #285: Add end-to-end MCP-only PlaySpec lifecycle test

Repository: cksdnr1/playspec
URL: https://github.com/cksdnr1/playspec/issues/285

## Problem

There is no single MCP integration test proving the full PlaySpec lifecycle can run without CLI fallback. Individual MCP tools are tested, but the product requirement is an end-to-end MCP-only pipeline.

## Desired MCP-only pipeline

1. Create task.
2. Bind task/session if needed.
3. Render first prompt.
4. Add context/evidence if needed.
5. Complete each phase with gate results.
6. Render routed next phases.
7. Complete the final phase.
8. Collect final artifacts/status.
9. Generate or update evolution proposal when requested.
10. Avoid duplicate tasks/proposals when rerun.

## Scope

Add an end-to-end MCP-only lifecycle integration test and any small supporting API fixes required by the test.

The test should use a minimal workflow fixture with at least:

- a source problem input
- one normal phase
- one gated phase result
- a final phase
- artifact outputs
- optional evolution context

## Acceptance criteria

- A test demonstrates task creation through MCP, not direct store setup.
- The test renders and completes multiple phases through MCP.
- The test covers a gated phase result and next-phase routing.
- The test completes the final phase and asserts terminal task status/artifacts.
- The test exercises project-local workspace behavior.
- The test includes a duplicate rerun check once MCP dedupe support exists, or records that as a pending follow-up tied to the dedupe issue.
- The test includes evolution context/proposal handling once the MCP evolution contract is defined, or records that as a pending follow-up tied to the evolution issue.

## Constraints

- Do not use CLI as part of the MCP-only test setup except for test harness bootstrapping that does not simulate user workflow behavior.
- Do not make the test depend on external GitHub or network calls.
- Do not implement broad workflow redesign.
- Use a minimal fixture workflow instead of built-in production workflows.
