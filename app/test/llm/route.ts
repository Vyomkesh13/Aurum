// SECURITY: This route is publicly accessible in dev. Must be removed
// or env-gated before any production deployment.
import { NextResponse } from 'next/server'
import { getLLM, LLMError } from '@/lib/llm'

export async function GET() {
  try {
    const llm = getLLM()

    const response = await llm.generate(
      [{ role: 'user', content: 'Say hello in exactly 5 words.' }],
      { temperature: 0.2, maxTokens: 50,thinkingBudget: 0 }
    )

    return NextResponse.json({
      ok: true,
      provider: llm.name,
      response,
    })
  } catch (err) {
    if (err instanceof LLMError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          code: err.code,
          provider: err.provider,
          retryable: err.retryable,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}