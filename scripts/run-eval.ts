/**
 * CLI eval runner.
 * Run: npx tsx scripts/run-eval.ts [--limit N] [--difficulty easy|medium|hard]
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { loadEvalCases, runEvaluation, writeReports, printSummary } from '../lib/eval'

function parseArgs(): { limit?: number; difficulty?: 'easy' | 'medium' | 'hard' } {
  const args = process.argv.slice(2)
  const out: { limit?: number; difficulty?: 'easy' | 'medium' | 'hard' } = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      out.limit = parseInt(args[++i], 10)
    } else if (args[i] === '--difficulty' && args[i + 1]) {
      const d = args[++i]
      if (d === 'easy' || d === 'medium' || d === 'hard') out.difficulty = d
    }
  }
  return out
}

async function main() {
  const opts = parseArgs()
  const cases = loadEvalCases(opts)
  console.log(`Loaded ${cases.length} cases${opts.difficulty ? ` (${opts.difficulty})` : ''}`)
  console.log(`Estimated runtime: ${Math.ceil((cases.length * 60) / 60)} min`)
  console.log()

  const { summary, results } = await runEvaluation({
    cases,
    onProgress: (current, total, caseId) => {
      console.log(`[${current}/${total}] ${caseId}...`)
    },
  })

  const paths = writeReports({ summary, results })
  printSummary(summary)
  console.log(`Reports written:`)
  console.log(`  JSON:    ${paths.jsonPath}`)
  console.log(`  CSV:     ${paths.csvPath}`)
  console.log(`  Summary: ${paths.summaryPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})