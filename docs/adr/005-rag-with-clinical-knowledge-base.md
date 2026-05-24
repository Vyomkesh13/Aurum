# ADR-005: RAG with multi-source clinical knowledge base

## Status
Accepted

## Context
LLMs hallucinate drug dosages, contraindications, diagnostic criteria, and clinical workup steps. For a clinical assistant these hallucinations are dangerous.

## Decision
Build a RAG layer using pgvector (already in Supabase) with a 161-entry multi-source knowledge base. Retrieve top-3 relevant entries by cosine similarity before each SOAP generation stage.

## Sources ingested
- WHO Essential Medicines List (30 entries) — drug dosing and contraindications
- OpenFDA drug labels (29 entries) — FDA-approved drug information
- MedlinePlus condition summaries (31 entries) — patient-facing condition overviews
- StatPearls via PubMed (11 entries) — peer-reviewed clinical abstracts
- NHS CKS / NICE guidelines (60 entries) — structured workup, red flags, differentials per condition

## Alternatives considered
- **No RAG** — Rejected: LLMs confidently hallucinate drug dosages and diagnostic criteria.
- **Full PubMed** — Rejected: 36M articles, significant indexing infrastructure required.
- **Pinecone or Weaviate** — Rejected: adds external dependency and cost. Supabase pgvector already in stack.
- **UpToDate** — Rejected: paywalled, licensing cost prohibitive.

## Consequences
- Drug and condition claims grounded in authoritative sources
- Retrieved sources visible in pipeline trace (auditability)
- Hallucination rate reduced from 2.71 to 1.90/5 after knowledge base expansion
- Knowledge base trivially updatable (edit JSON, re-run ingest)
- Only covers conditions in knowledge base — gaps exist for rare diseases
