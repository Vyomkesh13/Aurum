/**
 * SOAP pipeline orchestrator.
 * 6 stages: de-id → keywords → generate → critique → gate → reidentify + audit.
 */

import { deidentify, reidentify } from '@/lib/deidentify'
import { logLLMCall } from '@/lib/audit'
import { extractKeywords } from './stages/keywords'
import { generateSoap } from './stages/generate'
import { critiqueSoap } from './stages/critique'
import type { SoapInput, SoapResult, SoapNote } from './types'

export async function runSoapPipeline(input: SoapInput): Promise<SoapResult> {
  const timings: Record<string, number> = {}
  let totalTokens = 0

  // ---- STAGE 1: DE-IDENTIFY ----
  const t1 = Date.now()
  const deid = deidentify(input.transcript, input.patient)
  timings.deidentify = Date.now() - t1

  // ---- STAGE 2: KEYWORDS ----
  const kRes = await extractKeywords(deid.text)
  timings.keywords = kRes.latencyMs
  totalTokens += kRes.tokensUsed
  await logLLMCall({
    patientId: input.patientId ?? null,
    model: 'gemini-2.5-flash',
    deidentified: true,
    inputTokens: 0,
    outputTokens: kRes.tokensUsed,
    latencyMs: kRes.latencyMs,
  })

  // ---- STAGE 3: SEQUENTIAL SOAP GENERATION ----
  const gRes = await generateSoap({
    deidentifiedTranscript: deid.text,
    keywords: kRes.keywords,
  })
  timings.generate = gRes.latencyMs
  totalTokens += gRes.tokensUsed
  await logLLMCall({
    patientId: input.patientId ?? null,
    model: 'gemini-2.5-pro',
    deidentified: true,
    inputTokens: 0,
    outputTokens: gRes.tokensUsed,
    latencyMs: gRes.latencyMs,
  })

  // ---- STAGE 4: SELF-CRITIQUE ----
  const cRes = await critiqueSoap({
    deidentifiedTranscript: deid.text,
    note: gRes.note,
  })
  timings.critique = cRes.latencyMs
  totalTokens += cRes.tokensUsed
  await logLLMCall({
    patientId: input.patientId ?? null,
    model: 'gemini-2.5-pro',
    deidentified: true,
    inputTokens: 0,
    outputTokens: cRes.tokensUsed,
    latencyMs: cRes.latencyMs,
  })

  // ---- STAGE 5: AUTONOMY GATE ----
  // Per docs/autonomy.md, SOAP generation is "Confirm" level by default.
  // If confidence < 0.7, downgrade to "Suggest" via flags.
  // The actual decision happens in UI — here we just mark the result.
  // (Logic kept minimal in v1; expand in dashboard layer.)

  // ---- STAGE 6: RE-IDENTIFY ----
  const t6 = Date.now()
  const note: SoapNote = {
    subjective: reidentify(gRes.note.subjective, deid.mapping),
    objective: reidentify(gRes.note.objective, deid.mapping),
    assessment: reidentify(gRes.note.assessment, deid.mapping),
    plan: reidentify(gRes.note.plan, deid.mapping),
  }
  timings.reidentify = Date.now() - t6

  return {
    note,
    keywords: kRes.keywords,
    critique: cRes.critique,
    trace: {
      deidentifiedTranscript: deid.text,
      rawLlmNote: gRes.note,
      timings,
      tokensUsed: totalTokens,
    },
  }
}