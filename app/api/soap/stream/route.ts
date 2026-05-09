/**
 * SSE endpoint for streaming SOAP pipeline progress.
 * POST /api/soap/stream
 *
 * Streams events as the 6-stage pipeline progresses:
 *   { stage, status, payload? }
 *
 * Final event: { stage: 'done', payload: <SoapResult> }
 * On error:    { stage: 'error', message }
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deidentify, reidentify } from '@/lib/deidentify'
import { extractKeywords } from '@/lib/soap/stages/keywords'
import { generateSoap } from '@/lib/soap/stages/generate'
import { critiqueSoap } from '@/lib/soap/stages/critique'
import { logLLMCall } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  transcript: string
  patient: {
    name?: string
    dateOfBirth?: string
    phone?: string
    mrn?: string
  }
  patientId?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json()) as Body
  if (!body.transcript || body.transcript.trim().length < 20) {
    return new Response('Transcript too short', { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // ---- STAGE 1 — De-identify ----
        send({ stage: 'deidentify', status: 'running' })
        const deid = deidentify(body.transcript, body.patient)
        send({
          stage: 'deidentify',
          status: 'done',
          payload: { identifiersFound: deid.identifiersFound },
        })

        // ---- STAGE 2 — Keywords ----
        send({ stage: 'keywords', status: 'running' })
        const kRes = await extractKeywords(deid.text)
        await logLLMCall({
          patientId: body.patientId ?? null,
          model: 'gemini-2.5-flash',
          deidentified: true,
          inputTokens: 0,
          outputTokens: kRes.tokensUsed,
          latencyMs: kRes.latencyMs,
        })
        send({
          stage: 'keywords',
          status: 'done',
          payload: { keywords: kRes.keywords, latencyMs: kRes.latencyMs },
        })

        // ---- STAGE 3 — Sequential SOAP ----
        send({ stage: 'generate', status: 'running' })
        const gRes = await generateSoap({
          deidentifiedTranscript: deid.text,
          keywords: kRes.keywords,
        })
        await logLLMCall({
          patientId: body.patientId ?? null,
          model: 'gemini-2.5-flash',
          deidentified: true,
          inputTokens: 0,
          outputTokens: gRes.tokensUsed,
          latencyMs: gRes.latencyMs,
        })
        send({
          stage: 'generate',
          status: 'done',
          payload: {
            chunksRetrieved: gRes.chunksRetrieved,
            latencyMs: gRes.latencyMs,
          },
        })

        // ---- STAGE 4 — Self-critique ----
        send({ stage: 'critique', status: 'running' })
        const cRes = await critiqueSoap({
          deidentifiedTranscript: deid.text,
          note: gRes.note,
        })
        await logLLMCall({
          patientId: body.patientId ?? null,
          model: 'gemini-2.5-flash',
          deidentified: true,
          inputTokens: 0,
          outputTokens: cRes.tokensUsed,
          latencyMs: cRes.latencyMs,
        })
        send({
          stage: 'critique',
          status: 'done',
          payload: { critique: cRes.critique, latencyMs: cRes.latencyMs },
        })

        // ---- STAGE 5 — Autonomy gate (informational) ----
        send({
          stage: 'gate',
          status: 'done',
          payload: {
            confidence: cRes.critique.confidence,
            requiresReview: cRes.critique.confidence < 0.7,
          },
        })

        // ---- STAGE 6 — Re-identify ----
        send({ stage: 'reidentify', status: 'running' })
        const note = {
          subjective: reidentify(gRes.note.subjective, deid.mapping),
          objective: reidentify(gRes.note.objective, deid.mapping),
          assessment: reidentify(gRes.note.assessment, deid.mapping),
          plan: reidentify(gRes.note.plan, deid.mapping),
        }
        send({ stage: 'reidentify', status: 'done' })

        // ---- DONE ----
        send({
          stage: 'done',
          status: 'done',
          payload: {
            note,
            keywords: kRes.keywords,
            critique: cRes.critique,
            chunksRetrieved: gRes.chunksRetrieved,
            totalTokens: kRes.tokensUsed + gRes.tokensUsed + cRes.tokensUsed,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown pipeline error'
        send({ stage: 'error', status: 'failed', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}