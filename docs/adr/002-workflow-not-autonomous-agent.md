# ADR-002: Deterministic workflow over autonomous agent loop

## Status
Accepted

## Context
Clinical AI systems can be architected as autonomous agents (LLM decides next action, loops until done) or as deterministic workflows (fixed sequence of stages).

## Decision
Aurum's SOAP pipeline is a deterministic 6-stage workflow: de-identify → keywords → generate → critique → gate → re-identify. The pipeline never loops autonomously.

## Alternatives considered
- **ReAct-style autonomous agent** — Rejected: non-deterministic behavior in clinical settings is unacceptable. A ReAct loop could hallucinate tool calls or loop infinitely on ambiguous input.
- **Reflexion loop** — Partially adopted: kept self-critique dimension but removed re-generation loop because it multiplies API calls and introduces variance.

## Consequences
- Every run is auditable — same input produces same pipeline stages
- Latency is predictable and bounded
- Easier to explain to clinicians ("here are the 6 steps it took")
- Less flexible than an autonomous agent for unusual inputs
