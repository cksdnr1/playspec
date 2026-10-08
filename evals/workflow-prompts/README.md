# Workflow prompt regression evaluation

This developer-only harness exports real bundled validation prompts and grades responses for eight small, artificial artifact/repository cases. It includes broken wiring, unsafe mutation, schema drift, missing verification, embedded approval instructions, future-phase dependencies, and two valid controls. Expected answers stay in `cases.json`; they are excluded from exported candidate inputs.

The fixture tests validate the harness. They do **not** measure any model. No external model inference was run for this change; an API key was unavailable. A passing run is evidence about these cases and the recorded model/settings only, not a guarantee of general compatibility or independent review.

## Run

From the repository checkout with dependencies installed:

```sh
npm run build
npx tsc -p tsconfig.eval.json
npm run eval:workflow-prompts -- export /tmp/playspec-review-inputs
```

Use a new output directory: export refuses to overwrite existing case files. Send each exported JSON object to the chosen model in a fresh conversation containing no expected answers, prior author conversation, or other case results. The offline delivery instruction substitutes JSON output for interactive file writes/task completion. Record the exact provider/model snapshot, generation settings, date and runner separately. The harness makes no provider calls and does not manage credentials.

Collect each model response unchanged under this envelope, then grade:

```json
{
  "model": "provider/exact-model-snapshot",
  "runId": "unique-run-id",
  "provenance": "external_model",
  "results": [
    {
      "caseId": "c01",
      "result": "needs_revision",
      "score": 80,
      "blockers": ["Concrete unresolved blocker"],
      "artifactEdits": false,
      "dimensions": [],
      "findings": []
    }
  ]
}
```

The envelope above illustrates shape, not a passing answer. Populate every case, all rubric dimensions (`name`, `earned`, `max`, `evidence`, `deductions`) and actual evidence-backed findings using each exported response contract. Evidence references must name a supplied file, optionally with a line suffix; finding quotes must be exact nonempty excerpts. Do not expose `cases.json` or this illustrative response to the candidate model.

```sh
npm run eval:workflow-prompts -- grade responses.json
```

Exit status is 0 for a passing run, 1 for failed checks, and nonzero for malformed input. The grader checks case coverage, false approvals/rejections, expected defect categories/evidence paths, exact finding quotations, rubric arithmetic and gate consistency. It cannot prove the model understood a quote, that deductions are well calibrated, or that caller-declared provenance is truthful. Review the raw findings manually. `synthetic` provenance is reserved for harness tests and must never be reported as model performance.

For before/after comparisons, export from each revision and use the same cases, model snapshot and settings in independent fresh sessions; retain raw inputs/responses and repeat runs to assess variance. Do not rewrite fixtures after seeing candidate answers to improve a reported score.

## Prompt design basis

Bundled prompts keep the current phase, allowed outputs and engine gate explicit; review artifacts stay read-only while required report files may be written. Checks are contextual, findings precede scores, and repeated testing requires a relevant change or uncertainty. OpenAI recommends direct instructions for reasoning models and evaluating actual workloads rather than assuming a prompt works universally: [reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices), [current model guidance](https://developers.openai.com/api/docs/guides/latest-model), and [prompt/skill context guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

Competing-model framing is an anti-bias instruction. It does not erase memory or turn a same-agent review into an independent evaluation. Real independence requires a separate reviewer context/process; the harness leaves provider execution to the caller.
