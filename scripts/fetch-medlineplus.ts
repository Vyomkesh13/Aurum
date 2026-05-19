/**
 * Fetches condition/disease information from MedlinePlus API.
 * Run: npx tsx scripts/fetch-medlineplus.ts
 * Output: data/medlineplus-raw.json — review manually, add to medical-knowledge.json
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { writeFileSync } from 'fs'
import { join } from 'path'

// Conditions covering weak eval categories
const CONDITIONS_TO_FETCH = [
  // Cardiology
  { term: 'angina', category: 'cardiovascular' },
  { term: 'atrial fibrillation', category: 'cardiovascular' },
  { term: 'heart failure', category: 'cardiovascular' },
  { term: 'acute coronary syndrome', category: 'cardiovascular' },
  // Neurology
  { term: 'stroke', category: 'neurology' },
  { term: 'migraine', category: 'neurology' },
  { term: 'seizure', category: 'neurology' },
  { term: 'transient ischemic attack', category: 'neurology' },
  // Psychiatry
  { term: 'schizophrenia', category: 'psychiatry' },
  { term: 'bipolar disorder', category: 'psychiatry' },
  { term: 'major depression', category: 'psychiatry' },
  { term: 'generalized anxiety disorder', category: 'psychiatry' },
  // Renal
  { term: 'acute kidney injury', category: 'renal' },
  { term: 'chronic kidney disease', category: 'renal' },
  { term: 'hyperkalemia', category: 'renal' },
  // Rheumatology
  { term: 'rheumatoid arthritis', category: 'rheumatology' },
  { term: 'systemic lupus erythematosus', category: 'rheumatology' },
  { term: 'gout', category: 'rheumatology' },
  // Infectious
  { term: 'pneumonia', category: 'infectious' },
  { term: 'urinary tract infection', category: 'infectious' },
  { term: 'sepsis', category: 'infectious' },
  { term: 'cellulitis', category: 'infectious' },
  // Endocrine
  { term: 'diabetic ketoacidosis', category: 'endocrine' },
  { term: 'hypothyroidism', category: 'endocrine' },
  { term: 'hyperthyroidism', category: 'endocrine' },
  // GI
  { term: 'appendicitis', category: 'gi' },
  { term: 'cholecystitis', category: 'gi' },
  { term: 'gastrointestinal bleeding', category: 'gi' },
  // Pulmonary
  { term: 'asthma', category: 'respiratory' },
  { term: 'COPD', category: 'respiratory' },
  { term: 'pulmonary embolism', category: 'respiratory' },
]

type MedlinePlusEntry = {
  term: string
  category: string
  title: string
  summary: string
  url: string
}

async function fetchCondition(
  term: string,
  category: string
): Promise<MedlinePlusEntry | null> {
  try {
    const encoded = encodeURIComponent(term)
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encoded}&retmax=1`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  [${term}] HTTP ${res.status}`)
      return null
    }

    const xml = await res.text()

    // Extract title
    const titleMatch = xml.match(/<content name="title"[^>]*>(.*?)<\/content>/s)
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? term

    // Extract FullSummary
    const summaryMatch = xml.match(/<content name="FullSummary"[^>]*>(.*?)<\/content>/s)
    const summary = summaryMatch?.[1]
      ?.replace(/<[^>]+>/g, '')
      ?.replace(/\s+/g, ' ')
      ?.trim()
      ?.slice(0, 600) ?? ''

    // Extract URL
    const urlMatch = xml.match(/url="([^"]+)"/)
    const sourceUrl = urlMatch?.[1] ?? ''

    if (!summary) {
      console.warn(`  [${term}] No summary found`)
      return null
    }

    return { term, category, title, summary, url: sourceUrl }
  } catch (err) {
    console.warn(`  [${term}] Error: ${err}`)
    return null
  }
}

async function main() {
  const results: MedlinePlusEntry[] = []

  for (const { term, category } of CONDITIONS_TO_FETCH) {
    process.stdout.write(`Fetching "${term}"...`)
    const entry = await fetchCondition(term, category)
    if (entry) {
      results.push(entry)
      console.log(` ✓ (${entry.summary.length} chars)`)
    } else {
      console.log(' ✗')
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  const outPath = join(process.cwd(), 'data', 'medlineplus-raw.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} entries to ${outPath}`)
  console.log('Review each entry, trim to 2-3 clinical sentences, add to medical-knowledge.json')
}

main().catch(console.error)