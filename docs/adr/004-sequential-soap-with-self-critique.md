# ADR-004: Sequential SOAP generation with self-critique

## Status
Accepted

## Context
A SOAP note has four interdependent sections. Assessment depends on Subjective + Objective. Plan depends on Assessment.

## Decision
Generate SOAP sections sequentially (S → O → A → P), each conditioned on all previous sections. Follow with a single-pass self-critique using a 7-dimension rubric producing a confidence score and typed hallucination flags.

## Alternatives considered
- **Single-prompt generation** — Rejected: loses dependency structure. Assessment written without Objective tends to hallucinate exam findings.
- **Reflexion loop** — Evaluated: adds 2-3x API calls, introduces variance. Single-pass critique already surfaces most issues.
- **Separate models per section** — Partially adopted: evaluation harness uses a different model for judging (reduces self-enhancement bias).

## Consequences
- Assessment is grounded in both history and objective findings
- Self-critique surfaces hallucinations before doctor sees the note
- Confidence score drives the autonomy gate
- 5 LLM calls per note (4 generation + 1 critique)
- Same-model critique has known self-enhancement bias (measured: +0.65 calibration delta)
