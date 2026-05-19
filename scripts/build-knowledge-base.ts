/**
 * Converts openfda-raw.json + medlineplus-raw.json into
 * clean entries and appends to medical-knowledge.json.
 * Run: npx tsx scripts/build-knowledge-base.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
}

type RawFDA = {
  drug: string
  generic_name: string
  brand_name: string
  indications: string
  dosage: string
  contraindications: string
  warnings: string
}

type RawMedline = {
  term: string
  category: string
  title: string
  summary: string
  url: string
}

type KnowledgeEntry = {
  source: string
  category: string
  title: string
  content: string
  metadata: Record<string, string>
}

function buildFDAEntry(r: RawFDA, category: string): KnowledgeEntry {
  const parts: string[] = []
  if (r.indications) parts.push(`Indications: ${r.indications.slice(0, 200)}`)
  if (r.dosage) parts.push(`Dosing: ${r.dosage.slice(0, 200)}`)
  if (r.contraindications) parts.push(`Contraindications: ${r.contraindications.slice(0, 150)}`)
  if (r.warnings) parts.push(`Warnings: ${r.warnings.slice(0, 150)}`)

  return {
    source: 'openfda',
    category,
    title: r.generic_name || r.drug,
    content: parts.join(' '),
    metadata: { brand_name: r.brand_name, source_url: 'https://open.fda.gov' },
  }
}

// Map drug name to clinical category
const DRUG_CATEGORY_MAP: Record<string, string> = {
  furosemide: 'cardiovascular',
  spironolactone: 'cardiovascular',
  bicarbonate: 'renal',
  sevelamer: 'renal',
  alteplase: 'neurology',
  aspirin: 'cardiovascular',
  clopidogrel: 'cardiovascular',
  sumatriptan: 'neurology',
  topiramate: 'neurology',
  levetiracetam: 'neurology',
  risperidone: 'psychiatry',
  quetiapine: 'psychiatry',
  lithium: 'psychiatry',
  valproate: 'psychiatry',
  clonazepam: 'psychiatry',
  fluoxetine: 'psychiatry',
  methotrexate: 'rheumatology',
  hydroxychloroquine: 'rheumatology',
  prednisone: 'corticosteroid',
  naproxen: 'analgesic',
  celecoxib: 'analgesic',
  trimethoprim: 'antibiotic',
  doxycycline: 'antibiotic',
  vancomycin: 'antibiotic',
  fluconazole: 'antifungal',
  oseltamivir: 'antiviral',
  amlodipine: 'cardiovascular',
  ramipril: 'cardiovascular',
  digoxin: 'cardiovascular',
  nitroglycerin: 'cardiovascular',
}

function main() {
  // Load existing knowledge base
  const existingPath = join(process.cwd(), 'data', 'medical-knowledge.json')
  const existing: KnowledgeEntry[] = JSON.parse(readFileSync(existingPath, 'utf-8'))
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()))

  const newEntries: KnowledgeEntry[] = []

  // Process OpenFDA entries
  const fdaRaw: RawFDA[] = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'openfda-raw.json'), 'utf-8')
  )
  for (const r of fdaRaw) {
    const title = (r.generic_name || r.drug).toLowerCase()
    if (existingTitles.has(title)) {
      console.log(`[FDA] Skip (duplicate): ${r.generic_name}`)
      continue
    }
    const category = DRUG_CATEGORY_MAP[r.drug] ?? 'general'
    const entry = buildFDAEntry(r, category)
    if (entry.content.length < 50) {
      console.log(`[FDA] Skip (too short): ${r.generic_name}`)
      continue
    }
    newEntries.push(entry)
    existingTitles.add(title)
    console.log(`[FDA] ✓ ${entry.title} (${category})`)
  }

  // Process MedlinePlus entries
  const medlineRaw: RawMedline[] = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'medlineplus-raw.json'), 'utf-8')
  )
  for (const r of medlineRaw) {
    const title = r.title.toLowerCase()
    if (existingTitles.has(title)) {
      console.log(`[MedlinePlus] Skip (duplicate): ${r.title}`)
      continue
    }
    if (r.summary.length < 50) {
      console.log(`[MedlinePlus] Skip (too short): ${r.title}`)
      continue
    }
    newEntries.push({
      source: 'medlineplus',
      category: r.category,
      title: stripHtml(r.title),
      content: stripHtml(r.summary),
      metadata: { source_url: r.url },
    })
    existingTitles.add(title)
    console.log(`[MedlinePlus] ✓ ${r.title} (${r.category})`)
  }

  // Merge and write
  const merged = [...existing, ...newEntries]
  writeFileSync(existingPath, JSON.stringify(merged, null, 2))
  console.log(`\nDone. ${existing.length} existing + ${newEntries.length} new = ${merged.length} total entries`)
}

main()