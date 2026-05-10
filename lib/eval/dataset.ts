/**
 * Loads eval cases from data/eval-cases.json.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import type { EvalCase } from './types'

export function loadEvalCases(filter?: {
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  uncertaintyOnly?: boolean
  skip?: number
  limit?: number
}): EvalCase[] {
  const path = join(process.cwd(), 'data', 'eval-cases.json')
  const raw = readFileSync(path, 'utf-8')
  let cases = JSON.parse(raw) as EvalCase[]

  if (filter?.category) {
    cases = cases.filter((c) => c.category === filter.category)
  }
  if (filter?.difficulty) {
    cases = cases.filter((c) => c.difficulty === filter.difficulty)
  }
  if (filter?.uncertaintyOnly) {
    cases = cases.filter((c) => c.uncertaintyInjected)
  }
  if (filter?.skip) {
  cases = cases.slice(filter.skip)
  }
  if (filter?.limit) {
    cases = cases.slice(0, filter.limit)
  }

  return cases
}

export function getCaseById(id: string): EvalCase | null {
  const all = loadEvalCases()
  return all.find((c) => c.id === id) ?? null
}