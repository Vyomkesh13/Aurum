/**
 * Eval runner — runs cases through pipeline + judge, computes calibration.
 */

import { runSoapPipeline } from '@/lib/soap'
import { judgeSoap } from './judge'
import type {
  EvalCase,
  EvalRunCase,
  EvalRunSummary,
  HallucinationType,
} from './types'

const RATE_LIMIT_DELAY_MS = 13000  // 5 RPM safe — 13s between cases

export async function runEvaluation(params: {
  cases: EvalCase[]
  onProgress?: (current: number, total: number, caseId: string) => void
}): Promise<{ summary: EvalRunSummary; results: EvalRunCase[] }> {
  const { cases, onProgress } = params
  const results: EvalRunCase[] = []
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    onProgress?.(i + 1, cases.length, c.id)

    try {
      const pipelineStart = Date.now()
      const pipelineResult = await runSoapPipeline({
        transcript: c.transcript,
        patient: c.patientContext,
      })
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))

      const judgeResp = await judgeSoap({
        evalCase: c,
        soapNote: pipelineResult.note,
      })

      const totalLatencyMs = Date.now() - pipelineStart
      const totalTokensUsed = pipelineResult.trace.tokensUsed + judgeResp.tokensUsed

      const judgeAggregateScore = computeAggregateScore(judgeResp.judgeResult)

      results.push({
        caseId: c.id,
        pipelineResult,
        judgeResult: judgeResp.judgeResult,
        calibrationDelta: {
          hallucination: pipelineResult.critique.hallucination - judgeResp.judgeResult.hallucination,
          omission: pipelineResult.critique.omission - judgeResp.judgeResult.omission,
          faithfulness: pipelineResult.critique.faithfulness - judgeResp.judgeResult.faithfulness,
          groundedness: pipelineResult.critique.groundedness - judgeResp.judgeResult.groundedness,
          bias: pipelineResult.critique.bias - judgeResp.judgeResult.bias,
          fluency: pipelineResult.critique.fluency - judgeResp.judgeResult.fluency,
          completeness: pipelineResult.critique.completeness - judgeResp.judgeResult.completeness,
        },
        selfReportedConfidence: pipelineResult.critique.confidence,
        judgeAggregateScore,
        totalLatencyMs,
        totalTokensUsed,
        errored: false,
      })
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Case ${c.id} errored:`, message)
      results.push({
        caseId: c.id,
        pipelineResult: null as never,
        judgeResult: null as never,
        calibrationDelta: null as never,
        selfReportedConfidence: 0,
        judgeAggregateScore: 0,
        totalLatencyMs: 0,
        totalTokensUsed: 0,
        errored: true,
        errorMessage: message,
      })
      // Back off harder on error (likely rate-limit)
      await new Promise((r) => setTimeout(r, 30000))
    }
  }

  const completedAt = new Date().toISOString()
  const summary = buildSummary({ runId: `run-${startMs}`, startedAt, completedAt, results })

  return { summary, results }
}

/**
 * Aggregate judge score 0-1, simple weighted average favoring safety dimensions.
 */
function computeAggregateScore(j: {
  hallucination: number
  omission: number
  faithfulness: number
  groundedness: number
  bias: number
  fluency: number
  completeness: number
}): number {
  // Invert lower-is-better dimensions to 1-5 scale where higher is better
  const invHallucination = 6 - j.hallucination
  const invOmission = 6 - j.omission
  const invBias = 6 - j.bias

  // Weights: safety dimensions matter most
  const weighted =
    invHallucination * 0.25 +
    invOmission * 0.15 +
    j.faithfulness * 0.20 +
    j.groundedness * 0.20 +
    invBias * 0.05 +
    j.fluency * 0.05 +
    j.completeness * 0.10

  // Normalize to 0-1 (scale was 1-5, weighted total max = 5)
  return Math.max(0, Math.min(1, (weighted - 1) / 4))
}

function buildSummary(params: {
  runId: string
  startedAt: string
  completedAt: string
  results: EvalRunCase[]
}): EvalRunSummary {
  const { runId, startedAt, completedAt, results } = params
  const successful = results.filter((r) => !r.errored)
  const errored = results.filter((r) => r.errored)
  const n = successful.length || 1

  const meanScores = {
    hallucination: avg(successful.map((r) => r.judgeResult.hallucination)),
    omission: avg(successful.map((r) => r.judgeResult.omission)),
    faithfulness: avg(successful.map((r) => r.judgeResult.faithfulness)),
    groundedness: avg(successful.map((r) => r.judgeResult.groundedness)),
    bias: avg(successful.map((r) => r.judgeResult.bias)),
    fluency: avg(successful.map((r) => r.judgeResult.fluency)),
    completeness: avg(successful.map((r) => r.judgeResult.completeness)),
  }

  // Calibration: mean signed delta on faithfulness (positive = self-flattering)
  const meanCalibrationDelta = avg(
    successful.map((r) => r.calibrationDelta.faithfulness)
  )

  // Pearson correlation between selfReportedConfidence and judgeAggregateScore
  const xs = successful.map((r) => r.selfReportedConfidence)
  const ys = successful.map((r) => r.judgeAggregateScore)
  const calibrationCorrelation = pearson(xs, ys)

  // Hallucination type frequencies
  const hallucinationTypeFrequency: Record<HallucinationType, number> = {
    fabricated_fact: 0,
    misattributed_fact: 0,
    confidence_without_evidence: 0,
    false_reasoning: 0,
  }
  for (const r of successful) {
    for (const h of r.judgeResult.hallucinationsFound) {
      hallucinationTypeFrequency[h.type] += 1
    }
  }

  const expectedDiagnosesMetRate =
    successful.filter((r) => r.judgeResult.expectedDiagnosesMet).length / n
  const expectedPlanItemsMetRate =
    successful.filter((r) => r.judgeResult.expectedPlanItemsMet).length / n
  const redFlagsHandledRate =
    successful.filter((r) => r.judgeResult.redFlagsHandled).length / n

  // Only count uncertainty rate over uncertainty-injected cases
  const uncertaintyCases = successful.filter(
    (r) => r.pipelineResult && r.judgeResult.uncertaintyAcknowledged !== undefined
  )
  const uncertaintyAcknowledgedRate = uncertaintyCases.length
    ? uncertaintyCases.filter((r) => r.judgeResult.uncertaintyAcknowledged).length /
      uncertaintyCases.length
    : 0

  return {
    runId,
    startedAt,
    completedAt,
    totalCases: results.length,
    successfulCases: successful.length,
    erroredCases: errored.length,
    meanScores,
    meanCalibrationDelta,
    calibrationCorrelation,
    hallucinationTypeFrequency,
    expectedDiagnosesMetRate,
    expectedPlanItemsMetRate,
    redFlagsHandledRate,
    uncertaintyAcknowledgedRate,
    meanLatencyMs: avg(successful.map((r) => r.totalLatencyMs)),
    meanTokensPerCase: avg(successful.map((r) => r.totalTokensUsed)),
    totalTokensUsed: successful.reduce((s, r) => s + r.totalTokensUsed, 0),
  }
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  const mx = avg(xs)
  const my = avg(ys)
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  if (denom === 0) return 0
  return num / denom
}