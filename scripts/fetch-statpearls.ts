/**
 * Fetches StatPearls abstracts from PubMed using verified PMIDs.
 * Embeds and inserts directly into pgvector knowledge base.
 * Run: npx tsx scripts/fetch-statpearls.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { embed } from '../lib/embeddings'

// Verified StatPearls PMIDs from PubMed
const STATPEARLS_ARTICLES = [
  { pmid: '30969681', title: 'Essential Hypertension', category: 'cardiovascular' },
  { pmid: '32644442', title: 'Stable Angina', category: 'cardiovascular' },
  { pmid: '30844157', title: 'Acute Coronary Syndrome', category: 'cardiovascular' },
  { pmid: '30252328', title: 'Atrial Fibrillation', category: 'cardiovascular' },
  { pmid: '29763173', title: 'Ischemic Stroke', category: 'neurology' },
  { pmid: '32809622', title: 'Migraine Headache', category: 'neurology' },
  { pmid: '28722925', title: 'Acute Kidney Injury', category: 'renal' },
  { pmid: '28613500', title: 'Community-Acquired Pneumonia', category: 'respiratory' },
  { pmid: '28613651', title: 'Asthma', category: 'respiratory' },
  { pmid: '32809558', title: 'Diabetic Ketoacidosis', category: 'endocrine' },
  { pmid: '30725732', title: 'Urinary Tract Infection', category: 'infectious' },
  { pmid: '28723028', title: 'Rheumatoid Arthritis', category: 'rheumatology' },
  { pmid: '30969686', title: 'Schizophrenia', category: 'psychiatry' },
  { pmid: '32644504', title: 'Major Depressive Disorder', category: 'psychiatry' },
  { pmid: '29630245', title: 'Acute Appendicitis', category: 'gi' },
]

type KnowledgeEntry = {
  source: string
  category: string
  title: string
  content: string
  metadata: Record<string, string>
}

async function fetchAbstract(pmid: string): Promise<string | null> {
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    // Extract just the abstract section
    const lines = text.split('\n')
    const abstractStart = lines.findIndex(l => l.trim().startsWith('AB  -') || l.includes('Abstract'))
    if (abstractStart === -1) return text.slice(0, 1500)
    // Collect abstract lines
    const abstractLines: string[] = []
    for (let i = abstractStart; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('FAU ') || line.startsWith('AU  ') || line.startsWith('AD  ')) break
      abstractLines.push(line.replace(/^AB\s+-\s+/, '').replace(/^\s+/, ''))
    }
    return abstractLines.join(' ').trim().slice(0, 1500)
  } catch {
    return null
  }
}

async function fetchFullText(pmid: string): Promise<string | null> {
  try {
    // Try XML format for richer content
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=xml&retmode=xml`
    const res = await fetch(url)
    if (!res.ok) return null
    const xml = await res.text()

    // Extract AbstractText sections
    const sections: string[] = []
    const abstractRegex = /<AbstractText[^>]*Label="([^"]*)"[^>]*>([\s\S]*?)<\/AbstractText>/g
    let match
    while ((match = abstractRegex.exec(xml)) !== null) {
      const label = match[1]
      const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (text.length > 20) {
        sections.push(`[${label}] ${text}`)
      }
    }

    if (sections.length > 0) return sections.join('\n').slice(0, 1500)

    // Fallback — unstructured abstract
    const unstructured = xml.match(/<AbstractText>([\s\S]*?)<\/AbstractText>/)
    if (unstructured) {
      return unstructured[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 1500)
    }

    return null
  } catch {
    return null
  }
}

async function main() {
  console.log(`Fetching ${STATPEARLS_ARTICLES.length} StatPearls articles from PubMed...\n`)

  // Load existing knowledge base
  const knowledgePath = join(process.cwd(), 'data', 'medical-knowledge.json')
  const existing: KnowledgeEntry[] = JSON.parse(readFileSync(knowledgePath, 'utf-8'))
  const existingTitles = new Set(existing.map(e => e.title.toLowerCase()))

  // Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let inserted = 0
  let skipped = 0
  let failed = 0
  const newEntries: KnowledgeEntry[] = []

  for (const { pmid, title, category } of STATPEARLS_ARTICLES) {
    process.stdout.write(`[${pmid}] ${title}...`)

    // Skip duplicates
    if (existingTitles.has(title.toLowerCase())) {
      console.log(` ↩ duplicate`)
      skipped++
      continue
    }

    // Fetch full text (structured abstract)
    let content = await fetchFullText(pmid)

    // Fallback to plain abstract
    if (!content || content.length < 100) {
      content = await fetchAbstract(pmid)
    }

    if (!content || content.length < 50) {
      console.log(` ✗ no content`)
      failed++
      continue
    }

    console.log(` ✓ (${content.length} chars)`)

    const entry: KnowledgeEntry = {
      source: 'statpearls_pubmed',
      category,
      title,
      content,
      metadata: {
        pmid,
        source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      },
    }

    newEntries.push(entry)
    existingTitles.add(title.toLowerCase())

    // Embed and insert into pgvector
    try {
      const embeddingText = `${title}\n\n${content}`
      const embedding = await embed(embeddingText, 'RETRIEVAL_DOCUMENT')
      const { error } = await supabase.from('medical_knowledge').insert({
        source: entry.source,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        metadata: entry.metadata,
        embedding,
      })
      if (error) {
        console.error(`  ✗ Insert failed: ${error.message}`)
      } else {
        inserted++
      }
    } catch (err) {
      console.error(`  ✗ Embed error: ${err}`)
    }

    // NCBI rate limit: 3 requests/second
    await new Promise(r => setTimeout(r, 400))
  }

  // Save updated JSON
  const merged = [...existing, ...newEntries]
  writeFileSync(knowledgePath, JSON.stringify(merged, null, 2))

  console.log(`
Done.
  Fetched:  ${newEntries.length}
  Inserted: ${inserted}
  Skipped:  ${skipped} (duplicates)
  Failed:   ${failed}
  Total in knowledge base: ${merged.length}
  `)
}

main().catch(console.error)