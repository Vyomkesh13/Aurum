# ADR-001: Custom LLM abstraction over LangChain

## Status
Accepted

## Context
Aurum needs to call LLMs from multiple stages of a clinical pipeline. LangChain is the default choice for most LLM applications.

## Decision
Build a custom `LLMProvider` interface with concrete implementations for Gemini, Groq, and MiMo rather than adopting LangChain.

## Alternatives considered
- **LangChain** — Rejected: 200+ transitive dependencies, opaque internals make debugging clinical pipelines harder, abstracts away token/latency data needed for evaluation.
- **LlamaIndex** — Rejected: same dependency concern, and we already built a lean pgvector retrieval module.
- **Direct SDK calls** — Rejected: makes provider swapping require edits across every stage file.

## Consequences
- Full visibility into every API call, easy provider swap via env var
- Forces explicit token/latency tracking (feeds directly into eval harness)
- We own error handling and retry logic
