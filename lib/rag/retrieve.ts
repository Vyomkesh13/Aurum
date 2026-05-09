/**
 * Retrieve top-k relevant knowledge chunks for a query.
 * Used by SOAP pipeline to ground generation in real medical sources.
 */

import { createClient } from '@/lib/supabase/server'
import { embed } from '@/lib/embeddings'
import type { KnowledgeChunk, RetrievalOptions } from './types'

export async function retrieve(
  query: string,
  options: RetrievalOptions = {}
): Promise<KnowledgeChunk[]> {
  const topK = options.topK ?? 3
  const minSimilarity = options.minSimilarity ?? 0.5

  // Embed query (RETRIEVAL_QUERY task type for asymmetric search)
  const queryEmbedding = await embed(query, 'RETRIEVAL_QUERY')

  let supabase
  try {
    supabase = await createClient()
  } catch {
    // Outside request scope (e.g. eval scripts) — use service-role client
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  // Call the match function (defined as RPC below in SQL)
  const { data, error } = await supabase.rpc('match_medical_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: minSimilarity,
    match_count: topK,
    category_filter: options.categoryFilter ?? null,
  })

  if (error) {
    console.error('[RAG] retrieval error:', error.message)
    return []
  }

  if (!data || !Array.isArray(data)) return []

  return data.map((row: {
    id: string
    source: string
    category: string
    title: string
    content: string
    similarity: number
  }) => ({
    id: row.id,
    source: row.source,
    category: row.category,
    title: row.title,
    content: row.content,
    similarity: row.similarity,
  }))
}

/**
 * Format retrieved chunks into a string for prompt injection.
 */
export function formatChunksForPrompt(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.title} (${c.category}, relevance ${c.similarity.toFixed(2)})]\n${c.content}`
    )
    .join('\n\n')
}