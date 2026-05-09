/**
 * Report writers — CSV per-case and JSON full run.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { EvalRunCase, EvalRunSummary } from './types'

export function writeReports(params: {
  summary: EvalRunSummary
  results: EvalRunCase[]
  outDir?: string
}): { jsonPath: string; csvPath: string; summaryPath: string } {
  const outDir = params.outDir ?? join(process.cwd(), 'data', 'eval-runs')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const runId = params.summary.runId
  const jsonPath = join(outDir, `${runId}.json`)
  const csvPath = join(outDir, `${runId}.csv`)
  const summaryPath = join(outDir, `${runId}-summary.json`)

  // Full JSON dump
  writeFileSync(
    jsonPath,
    JSON.stringify({ summary: params.summary, results: params.results }, null, 2)
  )

  // Summary alone
  writeFileSync(summaryPath, JSON.stringify(params.summary, null, 2))

  // Per-case CSV
  const headers = [
    'case_id',
    'errored',
    'judge_hallucination',
    'judge_omission',
    'judge_faithfulness',
    'judge_groundedness',
    'judge_bias',
    'judge_fluency',
    'judge_completeness',
    'judge_aggregate_score',
    'self_reported_confidence',
    'cal_delta_faithfulness',
    'cal_delta_hallucination',
    'expected_diagnoses_met',
    'expected_plan_items_met',
    'red_flags_handled',
    'uncertainty_acknowledged',
    'hallucinations_count',
    'latency_ms',
    'tokens_used',
    'feedback',
  ]

  const rows = params.results.map((r) => {
    if (r.errored) {
      return [r.caseId, 'true', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', r.errorMessage ?? '']
    }
    const j = r.judgeResult
    return [
      r.caseId,
      'false',
      j.hallucination,
      j.omission,
      j.faithfulness,
      j.groundedness,
      j.bias,
      j.fluency,
      j.completeness,
      r.judgeAggregateScore.toFixed(3),
      r.selfReportedConfidence.toFixed(3),
      r.calibrationDelta.faithfulness.toFixed(2),
      r.calibrationDelta.hallucination.toFixed(2),
      j.expectedDiagnosesMet,
      j.expectedPlanItemsMet,
      j.redFlagsHandled,
      j.uncertaintyAcknowledged,
      j.hallucinationsFound.length,
      r.totalLatencyMs,
      r.totalTokensUsed,
      escapeCsv(j.feedback),
    ]
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  writeFileSync(csvPath, csv)

  return { jsonPath, csvPath, summaryPath }
}

function escapeCsv(s: string): string {
  if (!s) return ''
  if (/[,"\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function printSummary(summary: EvalRunSummary): void {
  console.log('\n' + '='.repeat(60))
  console.log(`Aurum-SOAP-Bench  ·  Run: ${summary.runId}`)
  console.log('='.repeat(60))
  console.log(`Cases: ${summary.successfulCases} succeeded / ${summary.totalCases} total (${summary.erroredCases} errored)`)
  console.log(`\nMEAN SCORES (lower better: hallucination/omission/bias):`)
  console.log(`  hallucination:    ${summary.meanScores.hallucination.toFixed(2)}`)
  console.log(`  omission:         ${summary.meanScores.omission.toFixed(2)}`)
  console.log(`  faithfulness:     ${summary.meanScores.faithfulness.toFixed(2)}`)
  console.log(`  groundedness:     ${summary.meanScores.groundedness.toFixed(2)}`)
  console.log(`  bias:             ${summary.meanScores.bias.toFixed(2)}`)
  console.log(`  fluency:          ${summary.meanScores.fluency.toFixed(2)}`)
  console.log(`  completeness:     ${summary.meanScores.completeness.toFixed(2)}`)
  console.log(`\nCALIBRATION:`)
  console.log(`  mean self-vs-judge delta: ${summary.meanCalibrationDelta.toFixed(2)}  (positive = self-flattering)`)
  console.log(`  confidence/quality correlation: ${summary.calibrationCorrelation.toFixed(2)}  (1.0 = perfectly calibrated)`)
  console.log(`\nHALLUCINATION TYPES:`)
  for (const [t, n] of Object.entries(summary.hallucinationTypeFrequency)) {
    console.log(`  ${t.padEnd(32)} ${n}`)
  }
  console.log(`\nCOVERAGE:`)
  console.log(`  expected diagnoses met:    ${(summary.expectedDiagnosesMetRate * 100).toFixed(0)}%`)
  console.log(`  expected plan items met:   ${(summary.expectedPlanItemsMetRate * 100).toFixed(0)}%`)
  console.log(`  red flags handled:         ${(summary.redFlagsHandledRate * 100).toFixed(0)}%`)
  console.log(`  uncertainty acknowledged:  ${(summary.uncertaintyAcknowledgedRate * 100).toFixed(0)}%`)
  console.log(`\nPERFORMANCE:`)
  console.log(`  mean latency:    ${(summary.meanLatencyMs / 1000).toFixed(1)}s`)
  console.log(`  mean tokens:     ${summary.meanTokensPerCase.toFixed(0)}`)
  console.log(`  total tokens:    ${summary.totalTokensUsed}`)
  console.log('='.repeat(60) + '\n')
}