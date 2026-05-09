/**
 * Test route — verifies RAG retrieval works.
 * GET /test/rag?q=YOUR_QUERY (must be logged in)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retrieve } from '@/lib/rag/retrieve'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Sign in at /login first' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? 'patient with chest pain on warfarin'

  try {
    const chunks = await retrieve(query, { topK: 5, minSimilarity: 0.4 })
    return NextResponse.json({
      ok: true,
      query,
      results: chunks.map((c) => ({
        title: c.title,
        category: c.category,
        similarity: c.similarity.toFixed(3),
        contentPreview: c.content.slice(0, 120) + '...',
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}