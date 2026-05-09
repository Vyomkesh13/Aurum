export type KnowledgeChunk = {
  id: string
  source: string
  category: string
  title: string
  content: string
  similarity: number       // 0-1, cosine similarity to query
}

export type RetrievalOptions = {
  topK?: number            // default 3
  categoryFilter?: string  // restrict to e.g. 'cardiovascular'
  minSimilarity?: number   // default 0.5 — drop weak matches
}