/**
 * Stage 4 — Self-critique.
 * Separate LLM call scores the SOAP against 7 evaluation dimensions.
 * Output drives the autonomy gate (Stage 5).
 */

import { getLLM } from '@/lib/llm'
import { CRITIQUE_PROMPT } from '../prompts'
import type { CritiqueScores, SoapNote } from '../types'

function getModel(): string {
  const provider = process.env.LLM_PROVIDER ?? 'gemini'
  if (provider === 'mimo') return 'mimo-v2.5-pro'
  if (provider === 'groq') return 'llama-3.3-70b-versatile'
  return 'gemini-2.5-flash'
}

export async function critiqueSoap(params: {
  deidentifiedTranscript: string
  note: SoapNote
}): Promise<{ critique: CritiqueScores; tokensUsed: number; latencyMs: number }> {
  const { deidentifiedTranscript, note } = params
  const llm = getLLM()

  const userMessage =
    `Original transcript:\n${deidentifiedTranscript}\n\n` +
    `Generated SOAP note:\n` +
    `[Subjective]\n${note.subjective}\n\n` +
    `[Objective]\n${note.objective}\n\n` +
    `[Assessment]\n${note.assessment}\n\n` +
    `[Plan]\n${note.plan}`

  const response = await llm.generate(
    [{ role: 'user', content: userMessage }],
    {
      model: getModel(),
      systemPrompt: CRITIQUE_PROMPT,
      temperature: 0.1,    // critique should be near-deterministic
      maxTokens: 4000,
    }
  )

  const critique = parseCritique(response.content)

  return {
    critique,
    tokensUsed: response.inputTokens + response.outputTokens,
    latencyMs: response.latencyMs,
  }
}

/**
 * Parse JSON critique from LLM output. Defensive: returns safe defaults if parse fails.
 */
function parseCritique(raw: string): CritiqueScores {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned)
    return {
      hallucination: clamp(parsed.hallucination, 1, 5, 3),
      omission: clamp(parsed.omission, 1, 5, 3),
      faithfulness: clamp(parsed.faithfulness, 1, 5, 3),
      groundedness: clamp(parsed.groundedness, 1, 5, 3),
      bias: clamp(parsed.bias, 1, 5, 3),
      fluency: clamp(parsed.fluency, 1, 5, 3),
      completeness: clamp(parsed.completeness, 1, 5, 3),
      confidence: clampFloat(parsed.confidence, 0, 1, 0.5),
      flags: Array.isArray(parsed.flags)
        ? parsed.flags.filter((f: unknown) => typeof f === 'string')
        : [],
    }
  } catch (e) {
    console.error('[CRITIQUE] Parse failed. Raw output:', raw)
    return {
      hallucination: 5,
      omission: 5,
      faithfulness: 1,
      groundedness: 1,
      bias: 3,
      fluency: 3,
      completeness: 1,
      confidence: 0,
      flags: ['Critique parse failed — review required'],
    }
  }
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function clampFloat(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}