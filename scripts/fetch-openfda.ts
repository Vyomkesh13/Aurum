/**
 * Fetches drug information from OpenFDA API.
 * Run: npx tsx scripts/fetch-openfda.ts
 * Output: data/openfda-raw.json — review manually, then add to medical-knowledge.json
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { writeFileSync } from 'fs'
import { join } from 'path'

// Drugs we need to expand coverage for — targeting weak eval categories
const DRUGS_TO_FETCH = [
  // Renal
  'furosemide', 'spironolactone', 'bicarbonate', 'sevelamer',
  // Neurology
  'alteplase', 'aspirin', 'clopidogrel', 'sumatriptan', 'topiramate', 'levetiracetam',
  // Psychiatry
  'risperidone', 'quetiapine', 'lithium', 'valproate', 'clonazepam', 'fluoxetine',
  // Rheumatology
  'methotrexate', 'hydroxychloroquine', 'prednisone', 'naproxen', 'celecoxib',
  // Infectious
  'trimethoprim', 'doxycycline', 'vancomycin', 'fluconazole', 'oseltamivir',
  // Cardiovascular (gaps)
  'amlodipine', 'ramipril', 'digoxin', 'clopidogrel', 'nitroglycerin',
]

type FDAEntry = {
  drug: string
  generic_name: string
  brand_name: string
  indications: string
  dosage: string
  contraindications: string
  warnings: string
}

async function fetchDrug(drugName: string): Promise<FDAEntry | null> {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${drugName}"&limit=1`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  [${drugName}] HTTP ${res.status}`)
      return null
    }
    const data = await res.json() as {
      results?: Array<{
        openfda?: {
          generic_name?: string[]
          brand_name?: string[]
        }
        indications_and_usage?: string[]
        dosage_and_administration?: string[]
        contraindications?: string[]
        warnings?: string[]
        warnings_and_cautions?: string[]
      }>
    }

    if (!data.results || data.results.length === 0) {
      console.warn(`  [${drugName}] No results`)
      return null
    }

    const r = data.results[0]
    return {
      drug: drugName,
      generic_name: r.openfda?.generic_name?.[0] ?? drugName,
      brand_name: r.openfda?.brand_name?.[0] ?? '',
      indications: truncate(r.indications_and_usage?.[0] ?? ''),
      dosage: truncate(r.dosage_and_administration?.[0] ?? ''),
      contraindications: truncate(r.contraindications?.[0] ?? ''),
      warnings: truncate(r.warnings?.[0] ?? r.warnings_and_cautions?.[0] ?? ''),
    }
  } catch (err) {
    console.warn(`  [${drugName}] Error: ${err}`)
    return null
  }
}

function truncate(text: string, maxChars = 500): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > maxChars ? clean.slice(0, maxChars) + '...' : clean
}

async function main() {
  const results: FDAEntry[] = []
  const seen = new Set<string>()

  for (const drug of DRUGS_TO_FETCH) {
    if (seen.has(drug)) continue
    seen.add(drug)
    process.stdout.write(`Fetching ${drug}...`)
    const entry = await fetchDrug(drug)
    if (entry) {
      results.push(entry)
      console.log(' ✓')
    } else {
      console.log(' ✗')
    }
    // Polite rate limiting
    await new Promise((r) => setTimeout(r, 300))
  }

  const outPath = join(process.cwd(), 'data', 'openfda-raw.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} entries to ${outPath}`)
  console.log('Review the file and extract 2-3 sentence summaries for medical-knowledge.json')
}

main().catch(console.error)