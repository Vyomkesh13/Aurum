/**
 * One-time ingestion: embed and insert medical knowledge.
 * Run: npx tsx scripts/ingest-medical-knowledge.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { embed } from '../lib/embeddings'

type Entry = {
  source: string
  category: string
  title: string
  content: string
  metadata?: Record<string, unknown>
}

async function main() {
  const path = join(process.cwd(), 'data', 'medical-knowledge.json')
  const entries: Entry[] = JSON.parse(readFileSync(path, 'utf-8'))
  console.log(`Loaded ${entries.length} entries`)

  // Service-role client (bypasses RLS — needed for insert)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Wipe existing rows so re-running is idempotent
  console.log('Clearing existing medical_knowledge rows...')
  const { error: delErr } = await supabase
    .from('medical_knowledge')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) {
    console.error('Failed to clear:', delErr.message)
    process.exit(1)
  }

  let inserted = 0
  let failed = 0
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    try {
      // Embed the title + content together for richer semantic match
      const text = `${e.title}\n\n${e.content}`
      const embedding = await embed(text, 'RETRIEVAL_DOCUMENT')

      const { error } = await supabase.from('medical_knowledge').insert({
        source: e.source,
        category: e.category,
        title: e.title,
        content: e.content,
        metadata: e.metadata ?? {},
        embedding,
      })

      if (error) {
        console.error(`[${i + 1}] ${e.title} — insert failed: ${error.message}`)
        failed++
      } else {
        console.log(`[${i + 1}/${entries.length}] ${e.title} ✓`)
        inserted++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${i + 1}] ${e.title} — embed failed: ${msg}`)
      failed++
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Failed: ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})