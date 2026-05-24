# ADR-003: De-identify before every LLM call

## Status
Accepted

## Context
SOAP note generation requires sending patient transcript text to external LLM APIs. Patient data includes PHI under HIPAA Safe Harbor.

## Decision
All patient identifiers are stripped before text leaves our infrastructure, even in Phase A (synthetic data only). Re-identification happens locally after generation using a deterministic token mapping.

## Alternatives considered
- **Send full transcript** — Rejected: violates HIPAA Safe Harbor even with a BAA.
- **Anonymization via LLM** — Rejected: non-deterministic, LLM can miss identifiers, fails audit requirements.
- **On-premise LLM only** — Rejected: requires GPU infrastructure, not viable on zero budget.

## Consequences
- PHI never leaves local infrastructure
- Compliant with HIPAA Safe Harbor by design
- Audit log records deidentified: true on every LLM call
- Two-pass processing adds complexity
