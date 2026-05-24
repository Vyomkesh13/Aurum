/**
 * Ingests NHS CKS clinical workup data into pgvector knowledge base.
 * Each condition generates 3 entries: assessment, management, differentials.
 * Run: npx tsx scripts/ingest-cks-workup.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { embed } from '../lib/embeddings'

type CKSSection = {
  condition: string
  slug: string
  sections: Record<string, string>
}

const SECTION_LABELS: Record<string, string> = {
  'diagnosis/assessment': 'Diagnostic Workup',
  'diagnosis/diagnosis': 'Diagnostic Criteria',
  'diagnosis/differential-diagnosis': 'Differential Diagnosis',
  'management': 'Management and Red Flags',
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const rawPath = join(process.cwd(), 'data', 'cks-workup-data.json')
  const data: CKSSection[] = JSON.parse(readFileSync(rawPath, 'utf-8'))

  console.log(`Loaded ${data.length} conditions from NHS CKS\n`)

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const item of data) {
    for (const [sectionKey, content] of Object.entries(item.sections)) {
      if (!content || content.length < 100) {
        skipped++
        continue
      }

      const label = SECTION_LABELS[sectionKey] ?? sectionKey
      const title = `${item.condition} — ${label}`

      process.stdout.write(`[${title}]...`)

      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('medical_knowledge')
          .select('id')
          .eq('title', title)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log(' ↩ duplicate')
          skipped++
          continue
        }

        // Embed
        const embeddingText = `${title}\n\n${content}`
        const embedding = await embed(embeddingText, 'RETRIEVAL_DOCUMENT')

        // Determine category from condition
        const category = getCategory(item.condition)

        // Insert
        const { error } = await supabase.from('medical_knowledge').insert({
          source: 'nhs_cks',
          category,
          title,
          content: content.slice(0, 1500),
          metadata: {
            condition: item.condition,
            section: sectionKey,
            source_url: `https://cks.nice.org.uk/topics/${item.slug}/`,
          },
          embedding,
        })

        if (error) {
          console.log(` ✗ ${error.message}`)
          failed++
        } else {
          console.log(' ✓')
          inserted++
        }
      } catch (err) {
        console.log(` ✗ ${err}`)
        failed++
      }

      // Rate limit embeddings
      await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`
Done.
  Inserted: ${inserted}
  Skipped:  ${skipped}
  Failed:   ${failed}
  `)
}

function getCategory(condition: string): string {
  const map: Record<string, string> = {
    'Hypothyroidism': 'endocrine',
    'Stable Angina': 'cardiovascular',
    'Acute Coronary Syndrome': 'cardiovascular',
    'Atrial Fibrillation': 'cardiovascular',
    'Ischemic Stroke / TIA': 'neurology',
    'Migraine Headache': 'neurology',
    'Acute Kidney Injury': 'renal',
    'Community-Acquired Pneumonia': 'respiratory',
    'Asthma': 'respiratory',
    'Diabetic Ketoacidosis': 'endocrine',
    'Urinary Tract Infection': 'infectious',
    'Rheumatoid Arthritis': 'rheumatology',
    'Schizophrenia': 'psychiatry',
    'Major Depressive Disorder': 'psychiatry',
    'Acute Appendicitis': 'gi',
    'Heart Failure': 'cardiovascular',
    'Syncope': 'cardiovascular',
    'First Episode Psychosis': 'psychiatry',
    'Gout': 'rheumatology',
    'Acute Otitis Media': 'pediatric',
  }
  return map[condition] ?? 'general'
}

main().catch(console.error)