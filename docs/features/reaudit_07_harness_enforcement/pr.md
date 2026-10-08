Three failed harness attempts set blocked/circuitBreaker, but completePhase still advances. An attempt for a different phase can also replace the current phase record.

Check the current phase harness inside the shared completion lock before artifacts, feedback or state writes. Block completion while blocked/circuitBreaker is true. Attempt and reset mutations load fresh task state under the same mutation lock with pending completion recovery; reject attempts for a noncurrent phase to avoid overwriting its record. Explicit reset remains the documented human-review recovery route. Read-only prompt/status inspection remains available.

Validation: Build and 99 Core/MCP harness tests passed. Exhausted retries block phase completion without history writes; explicit reset restores progress and noncurrent attempt writes reject.

Task: `reaudit_07_harness_enforcement`.
