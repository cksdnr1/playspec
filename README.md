# PlaySpec

**A local workflow engine for LLM-assisted development — with state, safety, and memory.**

---

## What is PlaySpec?

When you use an LLM to build software, you quickly hit the same wall: the AI has no memory of what it did last phase, no awareness that you refactored over the weekend, and no way to roll back when it breaks something.

PlaySpec solves this by treating your LLM development work as structured, stateful tasks. It tracks where you are, renders the right prompt for each phase, collects evidence when work is done, and rolls back safely when things go wrong.

**Who it is for:** developers who use LLMs (Claude Code, Codex, or similar tools) to build features and want structured, repeatable workflows instead of ad-hoc prompting.

---

## Core Concepts

| Concept | What it means |
|---|---|
| **Task** | One unit of work — a feature, bug fix, or spec. Each task has its own isolated folder. |
| **Phase** | A numbered step inside a task (e.g. spec writing, implementation, review). PlaySpec tracks which phase you are on. |
| **Workflow** | A YAML definition of the phase sequence for a task type (e.g. `multi-spec`, `simple-bug`). |
| **Evidence** | Automatically collected artifacts after each phase — git diff, test results, lint output. No manual copy-paste. |
| **Rollback** | If a phase goes wrong, `playspec rollback` reverts state and optionally the git working tree — safely, with your approval. |
| **Evolution** | PlaySpec records patterns in your corrections. When the same fix appears repeatedly, it proposes a template or rule improvement. You approve it before it applies. |

---

## Why PlaySpec is Different

**Compared to prompt-only workflows:**
- Your prompts carry full task context automatically — phase history, target files, relevant rules.
- You never manually copy git diffs or test logs into a prompt again.
- Phase state is preserved across sessions. Closing your terminal does not lose context.

**Compared to ad-hoc AI coding:**
- Each phase has a defined output. The AI knows exactly what it should produce.
- Completion is not just moving on — evidence is collected, a snapshot is saved, a rollback point is created.
- If the codebase changes between sessions (e.g. a weekend refactor), PlaySpec detects the drift and warns you before generating the next prompt.

**Key properties:**
- **State management** — Task state lives in `.playspec/`, versioned alongside your code.
- **Safety** — Dangerous operations (git rollback, evolution apply) require explicit user approval.
- **Repeatability** — Presets give you a working workflow from the first command.
- **Evolution** — Workflows improve over time based on what the AI gets wrong and what you fix.

---

## Features

### Developer UX
- `playspec next` — render the next phase prompt for the active task. No arguments needed.
- `playspec complete` — mark a phase done, collect evidence, create a snapshot and rollback point.
- `playspec view` — open a markdown preview of the current task state in your browser.
- HEAD pointer lets CLI users work without specifying task IDs every time.

### Safety
- **State desync detection** — if significant code changes happened since the last completed phase, PlaySpec warns you before generating the next prompt.
- **Safe rollback** — rolls back task state only, or optionally reverts git changes. Never runs destructive git operations on a dirty working tree without asking.
- **File locking** — all write operations are locked. Concurrent agents cannot corrupt task state.

### Automation
- **Harness mode** — run phases automatically with retry budgets and circuit breakers.
- **Severity-aware circuit breaker** — lint failures are treated differently from build failures. High-severity repeated failures stop automation before costs accumulate.
- **Failure signatures** — repeated failures are detected by pattern, not raw log comparison.

### AI Integration
- **MCP adapter** — Claude Code and Codex can call PlaySpec tools directly (Phase 4+).
- **Token optimizer** — long-running tasks use context tiering so prompts stay within token limits (Phase 8+).
- All MCP calls require an explicit `taskId` or `sessionId`. No global state leaks across agents.

### Long-term Knowledge
- **Archive** — completed tasks are moved to `archived/{YYYY-MM}/{task_id}/` with full history intact.
- **Human edit learner** — diffs between AI output and your manual corrections are recorded as learning signals.
- **Evolution proposals** — when correction patterns repeat, PlaySpec proposes a template or rule patch. You review and apply it.

---

## Quick Start

```bash
# Install dependencies and build
pnpm install
pnpm build

# Initialize a new PlaySpec workspace with the default preset
playspec init --preset default

# Create a new task
playspec create multi-spec "My Feature"

# Render the next phase prompt
playspec next

# After the AI completes the phase, mark it done
playspec complete

# If something went wrong, roll back
playspec rollback

# Preview task state in your browser
playspec view
```

Available presets: `default`, `cpp-vulkan`, `react-frontend`, `python-api`, `nestjs-backend`

---

## Project Structure

```
.playspec/
  HEAD                        # active task pointer (CLI only)
  config.yaml
  sessions/                   # per-client session context
  tasks/
    active/{task_id}/
      task.yaml               # task state
      memory.yaml
      prompts/                # rendered prompts per phase
      evidence/               # git diffs, test/lint results
      snapshots/              # state snapshots
      rollback/               # rollback points
      human-edits/            # AI-vs-human diff records
    archived/{YYYY-MM}/{task_id}/
  workflows/                  # phase sequence definitions
  templates/                  # prompt templates (Handlebars)
  rules/                      # global and phase-specific rules
  presets/                    # preset bundles
```

---

## CLI Reference

```bash
playspec init --preset <name>         # initialize workspace
playspec create <workflow> "<title>"  # create a new task
playspec list                         # list active tasks
playspec list --archived              # list archived tasks
playspec current                      # show active task
playspec use <task_id>                # switch active task

playspec next                         # render next phase prompt
playspec phase <n>                    # render a specific phase prompt
playspec complete                     # complete current phase
playspec complete --with-review       # complete with validation prompt

playspec evidence                     # collect evidence manually
playspec desync-check                 # check for codebase drift

playspec rollback                     # rollback to last safe point
playspec rollback --state-only        # rollback task state only
playspec rollback --git-only          # rollback git changes only

playspec close                        # close a task
playspec close --archive              # close and archive
playspec view                         # open markdown preview
playspec view --archived <task_id>    # view an archived task
```

---

## Architecture

PlaySpec separates concerns cleanly:

- **Core** — pure business logic, no CLI or UI dependencies. All functions accept explicit `taskId`.
- **CLI adapter** — resolves HEAD for human convenience, then calls Core.
- **MCP adapter** — exposes Core as MCP tools for Claude Code, Codex, and OpenClaw. Always requires explicit task context.
- **TaskStore** — currently YAML-backed. Interface is abstract; SQLite backend is planned for multi-agent scenarios.

---

## Development Status

PlaySpec is being built in phases:

| Phase | Scope | Status |
|---|---|---|
| 0 | Project bootstrap | Done |
| 1 | Core + CLI + Preset + HEAD + TaskStore | In progress |
| 2 | Completion engine (lock, snapshot, evidence) | Planned |
| 3 | State desync detector + safe rollback | Planned |
| 4 | MCP adapter | Planned |
| 5 | Archive system | Planned |
| 6 | Evolution system + human edit learner | Planned |
| 7 | Harness safety (retry budget, circuit breaker) | Planned |
| 8 | Token optimizer + workflow editing | Planned |
| 9 | Full markdown viewer | Planned |
| 10 | Future DAG preparation | Planned |

---

## License

MIT
