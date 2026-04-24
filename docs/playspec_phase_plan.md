
PlaySpec v2.5 — Practical Dev Phase Plan

0. 용어 정리

|   |   |
|---|---|
|용어|의미|
|Dev Phase|PlaySpec 자체를 구현하는 개발 단계|
|Workflow Phase|사용자가 PlaySpec로 진행하는 task 안의 phase|
|Core Module|PlaySpec 내부 기능 책임 영역|
|Task|사용자가 진행 중인 하나의 기능/버그/스펙 작업|
|Session|CLI, MCP, OpenClaw, Harness별 작업 context|

예:

playspec phase 3

여기서 phase 3은 Workflow Phase 3이다.

  

반면 이 문서의:

Dev Phase 1 — Core Foundation

은 PlaySpec 자체 구현 단계다.

  

전체 Dev Phase 요약

|   |   |   |
|---|---|---|
|Dev Phase|이름|핵심 목표|
|Dev Phase 0|Project Bootstrap|프로젝트 뼈대, 테스트 환경, mock FS 준비|
|Dev Phase 1|Core Foundation|init/create/next/phase 기본 동작|
|Dev Phase 1.5|Minimal Markdown Preview|아주 단순한 HTML markdown preview|
|Dev Phase 2|Completion Engine|complete, lock, snapshot, evidence, review|
|Dev Phase 3|Reality Safety|desync 감지, safe rollback|
|Dev Phase 4|MCP Adapter|Claude Code / Codex / OpenClaw 연동|
|Dev Phase 5|Archive & Knowledge Base|close/archive/archived context|
|Dev Phase 6|Evolution System|proposal, proactive evolution, human edit learner|
|Dev Phase 7|Automation Safety|retry budget, circuit breaker|
|Dev Phase 8|Token & Workflow Tools|token optimizer, workflow editing|
|Dev Phase 9|Full Markdown Viewer|제대로 된 viewer|
|Dev Phase 10|Future DAG Preparation|DAG/subtask schema 준비|

  

Dev Phase 0 — Project Bootstrap

Goal

PlaySpec를 안정적으로 개발할 수 있는 TypeScript 프로젝트 뼈대를 만든다.

Why This Phase Exists

PlaySpec는 파일을 많이 읽고 쓰는 도구다.  
초기부터 테스트 환경을 제대로 분리하지 않으면 실제 프로젝트의 .playspec 폴더를 오염시키거나, 테스트 간 상태 충돌이 발생한다.

In Scope

- package.json

- tsconfig.json

- vitest.config.ts

- src/ 기본 구조

- CLI entry point placeholder

- Core module skeleton

- 기본 타입 정의

- 기본 에러 타입

- Zod schema skeleton

- 테스트용 temp workspace helper

- memfs 또는 temp-dir 기반 filesystem test strategy

Required Dependencies

typescript

tsx

vitest

zod

commander

yaml

handlebars

chalk

ora

fast-glob

proper-lockfile

chokidar

execa

simple-git

marked

open

Test Strategy Decision

처음부터 테스트 파일시스템을 분리한다.

권장 방식:

1. unit test: memfs 또는 추상 FS adapter 사용

2. integration test: OS temp directory 사용

3. 실제 repo root에는 테스트 중 .playspec 생성 금지

Recommended Test Helpers

tests/helpers/createTempWorkspace.ts

tests/helpers/createMockFs.ts

tests/helpers/fixtures.ts

Acceptance Criteria

- pnpm install 가능

- pnpm build 통과

- pnpm test 실행 가능

- CLI가 최소 help를 출력한다

- 테스트는 실제 프로젝트 root에 .playspec를 만들지 않는다

- Core는 CLI/MCP에 의존하지 않는다

- 파일 접근은 나중에 교체 가능한 adapter 경계를 가진다

  

Dev Phase 1 — Core Foundation

Goal

사용자가 PlaySpec를 처음 설치하고, task를 만들고, prompt를 렌더할 수 있게 한다.

사용자 흐름:

playspec init --preset default

playspec create multi-spec "Feature Name"

playspec next

playspec phase 3

Important Risk

이 Dev Phase는 가장 크다.  
따라서 하나의 PR로 만들더라도 내부 커밋 단위를 반드시 쪼개야 한다.

Internal Milestones

Dev Phase 1.1 — CLI Skeleton + Schema

- commander 기반 CLI 구조

- init/create/list/current/use/next/phase 명령 placeholder

- Zod schema 정의

- error formatting

Acceptance:

- 모든 명령어가 help에 표시된다

- 아직 실제 동작은 없어도 command parsing은 된다

  

Dev Phase 1.2 — TaskStore + File Layout

- TaskStore interface

- YamlTaskStore 구현

- .playspec 생성

- task folder 생성

- task.yaml 생성

- memory.yaml 생성

Acceptance:

- playspec init --preset default가 .playspec 구조를 만든다

- playspec create가 task folder를 만든다

  

Dev Phase 1.3 — HEAD + Session Context

- .playspec/HEAD

- .playspec/sessions/cli.default.yaml

- ActiveTaskResolver

- SessionResolver

- CLI는 HEAD fallback 허용

- Core는 taskId 기반 호출 우선

Acceptance:

- create 후 HEAD가 새 task를 가리킨다

- current가 active task를 보여준다

- use TASK_ID가 HEAD를 변경한다

  

Dev Phase 1.4 — Workflow + Variable Resolver

- workflow load

- phaseOrder validation

- phase resolve

- next phase 계산

- variable resolve

- FEATURE_SLUG 자동 생성

- SPEC_FILE/HANDOFF_FILE 자동 생성

Acceptance:

- next가 현재 Workflow Phase를 계산한다

- phase 3이 명시 Workflow Phase를 찾는다

  

Dev Phase 1.5 — Template Renderer Hardening

- handlebars rendering

- include system

- circular include detection

- requiredVariables validation

- unresolved placeholder detection

- missing template error

Acceptance:

- next가 실제 prompt를 렌더한다

- include가 동작한다

- unresolved {{placeholder}}가 남으면 실패한다

- 잘못된 template/workflow는 친절한 에러를 낸다

Dev Phase 1 Out of Scope

- lock

- complete

- evidence

- rollback

- archive

- MCP

- evolution

- full viewer

Dev Phase 1 Final Acceptance

- init --preset default가 기본 workflow/templates/rules를 설치한다

- create가 독립 task folder를 생성한다

- next가 active task 기준으로 prompt를 렌더한다

- phase 3이 명시 phase prompt를 렌더한다

- CLI는 HEAD fallback을 사용한다

- Core API는 taskId 명시 호출을 지원한다

- 템플릿 오류는 사용자가 고칠 파일 경로를 알려준다

  

Dev Phase 1.5 — Minimal Markdown Preview

Goal

초기부터 긴 prompt와 markdown 문서를 브라우저에서 확인할 수 있게 한다.

Important Risk

여기서 React/Vite/Tailwind를 시작하면 안 된다.  
이 단계는 무식할 정도로 단순해야 한다.

Implementation Direction

- marked로 markdown을 HTML로 변환

- 임시 preview.html 생성

- open 라이브러리로 OS 기본 브라우저 열기

In Scope

- playspec view

- 최근 rendered prompt 보기

- task.yaml 요약 보기

- prompts/ 또는 outputs/ markdown 파일 보기

- 단일 정적 HTML 생성

Out of Scope

- React

- Vite

- Tailwind

- archive explorer

- proposal diff viewer

- evidence viewer

- full dashboard

CLI

playspec view

playspec view --task TASK_ID

playspec view --file path/to/file.md

Acceptance Criteria

- playspec view가 preview.html을 생성한다

- 브라우저가 자동으로 열린다

- 최근 prompt markdown을 볼 수 있다

- 별도의 frontend build step이 없다

  

Dev Phase 2 — Completion Engine

Goal

Workflow Phase 완료 시점에 상태 업데이트, snapshot, evidence, review를 남긴다.

Why This Phase Merges Multiple Concerns

complete가 단순히 currentPhase만 넘기면 실제로는 쓸모가 부족하다.  
완료 시점에는 최소한 아래가 함께 필요하다.

- safe write

- phaseHistory update

- snapshot

- evidence

- review

In Scope

- proper-lockfile 기반 write lock

- atomic write

- complete command

- phaseHistory update

- currentPhase 이동

- completion record

- task.yaml snapshot

- prompt snapshot

- git status 수집

- git diff --stat 수집

- changed files 수집

- complete --with-review

- review.yaml 저장

- validationTemplate 지원

CLI

playspec complete

playspec complete --with-review

playspec evidence

playspec snapshot

Out of Scope

- rollback 실행

- desync severity

- archive

- MCP

- evolution

Acceptance Criteria

- complete가 현재 Workflow Phase를 completed로 기록한다

- currentPhase가 다음 Workflow Phase로 이동한다

- evidence 파일이 생성된다

- review.yaml이 생성된다

- snapshot이 생성된다

- write operation은 lock을 사용한다

- lock timeout은 명확한 에러를 낸다

  

Dev Phase 3 — Reality Safety

Goal

PlaySpec 상태와 실제 Git 상태가 어긋났을 때 감지하고, 안전한 rollback을 제공한다.

In Scope

- StateDesyncDetector

- lastKnownGitHead 저장

- changed files since last complete

- deleted/renamed file 감지

- desync severity 계산

- next 전 sanity check

- rollback safe point

- state-only rollback

- git rollback preview

- clean working tree guard

CLI

playspec desync-check

playspec rollback

playspec rollback --state-only

playspec rollback --git-only

Safe Rollback Rules

- working tree가 clean일 때만 자동 git rollback 허용

- uncommitted changes가 있으면 preview만 제공

- 새 commit이 생겼으면 자동 patch rollback 금지

- untracked file 삭제는 기본 금지

- git stash는 사용자 승인 필요

Acceptance Criteria

- high desync는 next 전에 경고한다

- desync-check가 severity와 changed files를 보여준다

- rollback --state-only가 task 상태를 safe point로 되돌린다

- 위험한 Git 상태에서는 state-only rollback을 추천한다

  

Dev Phase 4 — MCP Adapter

Goal

Claude Code, Codex, OpenClaw가 PlaySpec Core를 사용할 수 있게 MCP server를 제공한다.

In Scope

- MCP stdio server

- task list/get

- render next prompt

- render explicit phase prompt

- complete phase

- collect evidence

- desync check

- state rollback

- session task set/get

- MCP input schema validation

Critical Rule

MCP는 taskId 또는 sessionId가 필수다.

MCP는 global HEAD fallback을 사용하지 않는다.

Acceptance Criteria

- MCP server가 stdio로 실행된다

- taskId/sessionId 없이 상태 변경 tool은 실패한다

- render_next_prompt는 CLI next와 같은 Core 결과를 반환한다

- MCP는 HEAD를 직접 읽지 않는다

  

Dev Phase 5 — Archive & Knowledge Base

Goal

종료된 task를 active 목록에서 제거하고, 기술 문서와 evidence/history를 장기 보존한다.

In Scope

- close task

- archive task

- close --archive

- archived/{YYYY-MM}/{task_id} 이동

- list --archived

- archived context read

- basic archived search

CLI

playspec close

playspec archive

playspec close --archive

playspec list --archived

playspec context archived TASK_ID

Acceptance Criteria

- closed task를 archive할 수 있다

- active task folder가 archived/{YYYY-MM}/{task_id}로 이동한다

- HEAD가 archived task를 가리키면 복구 안내를 제공한다

- archived task context를 읽을 수 있다

  

Dev Phase 6 — Evolution System

Goal

완료 이후 개선 후보를 준비하고, 사용자가 직접 evolve를 치지 않아도 next 시점에 자연스럽게 제안한다.

In Scope

- evolution context 생성

- proposal schema validation

- pending proposal 저장

- apply-evolution

- skip/view/apply UX

- proposal diff preview

- human edit diff 기록

- repeated human edit pattern context

Boundary

PlaySpec는 reasoning을 직접 하지 않는다.

Claude/Codex/OpenClaw가 분석하고 proposal을 제출한다.

PlaySpec는 proposal 저장/검증/적용만 담당한다.

CLI

playspec evolution-context

playspec propose-evolution proposal.yaml

playspec apply-evolution 1

playspec list-proposals

Acceptance Criteria

- complete 이후 evolution context가 생성된다

- next 시 pending proposal이 있으면 사용자에게 알려준다

- proposal은 schema validation을 통과해야 저장된다

- apply 전 diff preview를 보여준다

- 승인 전에는 templates/workflows/rules가 수정되지 않는다

- human edit diff가 task folder에 저장된다

  

Dev Phase 7 — Automation Safety

Goal

Harness나 multi-agent 자동 반복 실행에서 무한 실패 루프와 비용 폭발을 막는다.

In Scope

- harness mode schema

- retry budget

- phase attempt record

- failure signature

- failure severity

- severity-aware circuit breaker

- human_intervention_required state

- unblock command

CLI

playspec harness status --task TASK_ID

playspec record-attempt --task TASK_ID --phase 7 --status failed

playspec unblock --task TASK_ID

Acceptance Criteria

- attempt record가 phase별로 저장된다

- 같은 failure signature 반복 시 retry budget이 감소한다

- high/critical failure는 circuit breaker가 빠르게 발동한다

- low severity lint/format failure는 과하게 막지 않는다

- blocked task는 human_intervention_required 상태가 된다

  

Dev Phase 8 — Token & Workflow Tools

Goal

장기 task의 token 폭발을 막고, 사용자가 workflow를 CLI로 안전하게 수정할 수 있게 한다.

In Scope

- compact / strict / full mode

- context tiering

- memory window

- evidence summary injection

- old logs on-demand only

- workflow phase add/remove/reorder

- template path update

- requiredVariables update

- workflow validation after edit

CLI

playspec next --mode compact

playspec phase 7 --mode strict

playspec context --summary

  

playspec workflow add-phase multi-spec 7.1

playspec workflow remove-phase multi-spec 7.1

playspec workflow validate multi-spec

Acceptance Criteria

- compact/strict/full mode가 다르게 렌더된다

- old phase는 summary로만 주입된다

- full logs/diffs는 기본 prompt에 들어가지 않는다

- workflow edit 후 schema validation을 수행한다

- 잘못된 workflow는 저장하지 않는다

  

Dev Phase 9 — Full Markdown Viewer

Goal

초기 preview를 확장해 active task, archived task, evidence, proposal, rollback point를 모두 확인할 수 있게 한다.

In Scope

- React/Vite 기반 viewer 또는 lightweight web app

- active task dashboard

- archived task explorer

- session context viewer

- phase history timeline

- evidence viewer

- review viewer

- rendered prompt preview

- output markdown preview

- proposal diff viewer

- rollback point viewer

- human edit pattern viewer

Acceptance Criteria

- active task 상태를 볼 수 있다

- archived task를 탐색할 수 있다

- phase history timeline을 볼 수 있다

- evidence/review/proposal/rollback 기록을 볼 수 있다

  

Dev Phase 10 — Future DAG Preparation

Goal

v1에서는 linear workflow만 실행하지만, future DAG/subtask 확장을 막지 않게 schema를 준비한다.

In Scope

- workflowMode field

- DAG schema validation

- node dependsOn schema

- subtask metadata schema

- unsupported DAG execution error

Out of Scope

- DAG 실행

- parallel scheduler

- multi-agent task assignment

Acceptance Criteria

- workflowMode: linear는 기존처럼 동작한다

- workflowMode: dag schema를 validate할 수 있다

- dag 실행 요청 시 “not supported yet” 에러를 낸다

- Task model에 subtasks field가 있다

  

Milestone 기준

Milestone 1 — Local MVP

Dev Phase 0

Dev Phase 1

Dev Phase 1.5

사용 가능:

playspec init

playspec create multi-spec "Feature"

playspec next

playspec view

Milestone 2 — Safe Daily Use

Dev Phase 2

Dev Phase 3

사용 가능:

playspec complete --with-review

playspec rollback

playspec desync-check

Milestone 3 — MCP Ready

Dev Phase 4

Claude Code / Codex / OpenClaw 연동 가능.

Milestone 4 — Knowledge & Evolution

Dev Phase 5

Dev Phase 6

Archive와 Evolution 시작.

Milestone 5 — Automation Ready

Dev Phase 7

Dev Phase 8

Harness와 장기 task 대응.

Milestone 6 — Full UX

Dev Phase 9

Dev Phase 10

Full viewer와 future DAG 준비.

  

최종 구현 순서 추천

1. Dev Phase 0 — Project Bootstrap

2. Dev Phase 1 — Core Foundation

3. Dev Phase 1.5 — Minimal Markdown Preview

4. Dev Phase 2 — Completion Engine

5. Dev Phase 3 — Reality Safety

6. Dev Phase 4 — MCP Adapter

7. Dev Phase 5 — Archive & Knowledge Base

8. Dev Phase 6 — Evolution System

9. Dev Phase 7 — Automation Safety

10. Dev Phase 8 — Token & Workflow Tools

11. Dev Phase 9 — Full Markdown Viewer

12. Dev Phase 10 — Future DAG Preparation

  

핵심 변경 요약

이번 업데이트에서 반영한 리스크는 3개입니다.

1. Epic이라는 용어 제거

   → Dev Phase / Workflow Phase / Core Module로 정리

  

2. Dev Phase 1 Monster PR 리스크 완화

   → Dev Phase 1.1 ~ 1.5 내부 마일스톤으로 나눔

  

3. Minimal Viewer 오버엔지니어링 방지

   → React 없이 marked + open + preview.html로 처리

  

4. 파일 시스템 테스트 오염 방지

   → Dev Phase 0에서 memfs/temp workspace 전략을 필수화

