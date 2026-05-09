/**
 * Evaluation harness types.
 * Drives MedQA-derived test cases, hallucination-typed judging, and calibration tracking.
 */

import type { SoapNote, SoapResult } from '@/lib/soap'
import type { PatientContext } from '@/lib/deidentify'

/**
 * A single test case in the benchmark.
 * Sourced from MedQA, adapted to SOAP transcript format.
 */
export type EvalCase = {
  id: string                          // stable identifier, e.g. 'medqa-0001'
  source: 'medqa' | 'synthetic' | 'hybrid'
  category: string                    // 'cardiology', 'endocrine', etc.
  difficulty: 'easy' | 'medium' | 'hard'
  uncertaintyInjected: boolean        // true if case deliberately ambiguous

  // Inputs to the pipeline
  transcript: string
  patientContext: PatientContext

  // Ground-truth-ish metadata for judging
  expectedDiagnoses: string[]         // diagnoses that should appear in Assessment
  expectedPlanItems: string[]         // plan items that should appear
  redFlags: string[]                  // critical things the model must NOT miss
  knownAmbiguities: string[]          // areas where uncertainty is correct
}

/**
 * Hallucination types — Med-HALT taxonomy adapted for our use.
 */
export type HallucinationType =
  | 'fabricated_fact'         // claimed something not in transcript
  | 'misattributed_fact'      // got fact right but wrong context
  | 'confidence_without_evidence'  // firm clinical claim without basis
  | 'false_reasoning'         // logic chain doesn't follow

export type Hallucination = {
  type: HallucinationType
  section: 'subjective' | 'objective' | 'assessment' | 'plan'
  excerpt: string
  transcriptEvidence: string              // the offending text
  why: string                 // judge's reasoning for the flag
}

/**
 * Judge output for a single SOAP note.
 * Same dimensions as critique scores, plus hallucination typing and calibration.
 */
export type JudgeResult = {
  // Core 7 dimensions (same as critique rubric, scored by independent judge)
  hallucination: number       // 1-5, lower better
  omission: number            // 1-5, lower better
  faithfulness: number        // 1-5, higher better
  groundedness: number        // 1-5, higher better
  bias: number                // 1-5, lower better
  fluency: number             // 1-5, higher better
  completeness: number        // 1-5, higher better

  // Calibration tracking
  judgeConfidence: number     // 0-1, judge's confidence in its own scoring

  // Hallucination typing (when present)
  hallucinationsFound: Hallucination[]

  // Coverage checks (binary)
  expectedDiagnosesMet: boolean
  expectedPlanItemsMet: boolean
  redFlagsHandled: boolean
  uncertaintyAcknowledged: boolean    // for uncertainty-injected cases

  // Free-text feedback for prompt iteration
  feedback: string
}

/**
 * Full result for one test case run end-to-end.
 */
export type EvalRunCase = {
  caseId: string
  pipelineResult: SoapResult        // the SOAP + critique from our pipeline
  judgeResult: JudgeResult          // independent judge's assessment

  // Calibration delta — how off was self-critique vs independent judge?
  calibrationDelta: {
    hallucination: number           // critique - judge (positive = self-flattering)
    omission: number
    faithfulness: number
    groundedness: number
    bias: number
    fluency: number
    completeness: number
  }

  // Confidence vs actual quality
  selfReportedConfidence: number    // from pipeline.critique.confidence
  judgeAggregateScore: number       // judge's holistic quality score 0-1

  // Performance
  totalLatencyMs: number
  totalTokensUsed: number
  errored: boolean
  errorMessage?: string
}

/**
 * Aggregate across all cases — what we report.
 */
export type EvalRunSummary = {
  runId: string                     // ISO timestamp + short hash
  startedAt: string
  completedAt: string

  totalCases: number
  successfulCases: number
  erroredCases: number

  // Mean scores across all successful cases
  meanScores: {
    hallucination: number
    omission: number
    faithfulness: number
    groundedness: number
    bias: number
    fluency: number
    completeness: number
  }

  // Calibration analysis
  meanCalibrationDelta: number      // average self-critique inflation
  calibrationCorrelation: number    // -1 to 1, between confidence and actual quality

  // Hallucination type breakdown
  hallucinationTypeFrequency: Record<HallucinationType, number>

  // Coverage rates
  expectedDiagnosesMetRate: number  // 0-1
  expectedPlanItemsMetRate: number
  redFlagsHandledRate: number
  uncertaintyAcknowledgedRate: number

  // Performance
  meanLatencyMs: number
  meanTokensPerCase: number
  totalTokensUsed: number
}