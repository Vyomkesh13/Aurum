/**
 * SOAP pipeline types.
 */

import type { PatientContext } from '@/lib/deidentify'

export type SoapInput = {
  transcript: string                // free-text doctor input
  patient: PatientContext           // known patient fields for de-id
  patientId?: string                // for audit logging
  encounterId?: string              // for audit logging
}

export type SoapNote = {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export type CritiqueScores = {
  hallucination: number       // 1-5, lower is better (5 = many hallucinations)
  omission: number            // 1-5, lower is better
  faithfulness: number        // 1-5, higher is better
  groundedness: number        // 1-5, higher is better
  bias: number                // 1-5, lower is better
  fluency: number             // 1-5, higher is better
  completeness: number        // 1-5, higher is better
  confidence: number          // 0-1 overall confidence
  flags: string[]             // human-readable issues found
}

export type SoapResult = {
  note: SoapNote                    // the generated SOAP (re-identified)
  keywords: string[]                // from stage 2
  critique: CritiqueScores          // from stage 4
  trace: {
    deidentifiedTranscript: string  // what we sent to LLM
    rawLlmNote: SoapNote            // before re-id
    timings: Record<string, number> // stage name -> ms
    tokensUsed: number              // total across all calls
  }
}