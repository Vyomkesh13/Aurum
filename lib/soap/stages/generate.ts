/**
 * Stage 3 — Sequential SOAP generation.
 * Generates S → O → A → P, each conditioned on previous outputs + keywords.
 * RAG-grounded: retrieves relevant medical references before generation.
 */

import { getLLM } from '@/lib/llm'
import {
  SUBJECTIVE_PROMPT,
  OBJECTIVE_PROMPT,
  ASSESSMENT_PROMPT,
  PLAN_PROMPT,
} from '../prompts'
import { retrieve, formatChunksForPrompt } from '@/lib/rag/retrieve'
import type { SoapNote } from '../types'

const MODEL = 'gemini-2.5-flash'

export async function generateSoap(params: {
  deidentifiedTranscript: string
  keywords: string[]
}): Promise<{
  note: SoapNote
  tokensUsed: number
  latencyMs: number
  chunksRetrieved: number
}> {
  const { deidentifiedTranscript, keywords } = params
  const llm = getLLM()
  const keywordsLine = `Keywords for focus: ${keywords.join(', ')}`

  // ---- RAG: retrieve relevant medical knowledge ----
  const retrievalQuery = keywords.length
    ? keywords.slice(0, 8).join(', ')
    : deidentifiedTranscript.slice(0, 500)

  const chunks = await retrieve(retrievalQuery, { topK: 3, minSimilarity: 0.5 })
  const groundingContext = chunks.length
    ? `\n\nRELEVANT MEDICAL REFERENCES (use to ground claims; do not invent beyond these):\n${formatChunksForPrompt(chunks)}`
    : ''

  let totalTokens = 0
  let totalLatency = 0

  // ---- SUBJECTIVE ----
  const sRes = await llm.generate(
    [
      {
        role: 'user',
        content: `${keywordsLine}${groundingContext}\n\nTranscript:\n${deidentifiedTranscript}`,
      },
    ],
    {
      model: MODEL,
      systemPrompt: SUBJECTIVE_PROMPT,
      temperature: 0.3,
      maxTokens: 2000,
    }
  )
  totalTokens += sRes.inputTokens + sRes.outputTokens
  totalLatency += sRes.latencyMs
  const subjective = sRes.content.trim()

  // ---- OBJECTIVE ----
  const oRes = await llm.generate(
    [
      {
        role: 'user',
        content:
          `${keywordsLine}${groundingContext}\n\nTranscript:\n${deidentifiedTranscript}\n\n` +
          `Subjective (already written):\n${subjective}`,
      },
    ],
    {
      model: MODEL,
      systemPrompt: OBJECTIVE_PROMPT,
      temperature: 0.3,
      maxTokens: 1500,
    }
  )
  totalTokens += oRes.inputTokens + oRes.outputTokens
  totalLatency += oRes.latencyMs
  const objective = oRes.content.trim()

  // ---- ASSESSMENT ----
  const aRes = await llm.generate(
    [
      {
        role: 'user',
        content:
          `${keywordsLine}${groundingContext}\n\nTranscript:\n${deidentifiedTranscript}\n\n` +
          `Subjective:\n${subjective}\n\n` +
          `Objective:\n${objective}`,
      },
    ],
    {
      model: MODEL,
      systemPrompt: ASSESSMENT_PROMPT,
      temperature: 0.3,
      maxTokens: 2000,
    }
  )
  totalTokens += aRes.inputTokens + aRes.outputTokens
  totalLatency += aRes.latencyMs
  const assessment = aRes.content.trim()

  // ---- PLAN ----
  const pRes = await llm.generate(
    [
      {
        role: 'user',
        content:
          `${keywordsLine}${groundingContext}\n\nTranscript:\n${deidentifiedTranscript}\n\n` +
          `Subjective:\n${subjective}\n\n` +
          `Objective:\n${objective}\n\n` +
          `Assessment:\n${assessment}`,
      },
    ],
    {
      model: MODEL,
      systemPrompt: PLAN_PROMPT,
      temperature: 0.3,
      maxTokens: 2000,
    }
  )
  totalTokens += pRes.inputTokens + pRes.outputTokens
  totalLatency += pRes.latencyMs
  const plan = pRes.content.trim()

  return {
    note: { subjective, objective, assessment, plan },
    tokensUsed: totalTokens,
    latencyMs: totalLatency,
    chunksRetrieved: chunks.length,
  }
}