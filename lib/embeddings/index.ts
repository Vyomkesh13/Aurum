/**
 * Gemini embeddings wrapper.
 * Used for indexing the knowledge base and embedding queries at retrieval time.
 *
 * Note: Always uses Gemini regardless of LLM_PROVIDER — Groq doesn't offer
 * embeddings, so this is provider-fixed.
 */

import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-embedding-001'
const OUTPUT_DIMS = 768   // matches medical_knowledge.embedding column

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) {
    const key = process.env.GEMINI_API_KEY
    if (!key) {
      throw new Error('GEMINI_API_KEY missing — required for embeddings')
    }
    client = new GoogleGenAI({ apiKey: key })
  }
  return client
}

/**
 * Embed a single text. Returns a 768-dim vector.
 *
 * taskType matters for retrieval quality:
 *   - 'RETRIEVAL_DOCUMENT' for indexing knowledge base
 *   - 'RETRIEVAL_QUERY' for embedding user queries at search time
 */
export async function embed(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_QUERY'
): Promise<number[]> {
  const c = getClient()

  const response = await c.models.embedContent({
    model: MODEL,
    contents: [{ parts: [{ text }] }],
    config: {
      taskType,
      outputDimensionality: OUTPUT_DIMS,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values || values.length === 0) {
    throw new Error('Embedding returned empty vector')
  }
  return values
}

/**
 * Batch embed — for ingestion. Calls embed() one at a time.
 * Gemini's batch API has different shape; one-at-a-time is simpler for ~500 entries.
 */
export async function embedBatch(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  const out: number[][] = []
  for (const t of texts) {
    out.push(await embed(t, taskType))
  }
  return out
}