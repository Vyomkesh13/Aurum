/**
 * MiMo provider — Xiaomi MiMo-V2.5-Pro via Token Plan API.
 * Used for eval generation + judging (paid tier, no quota issues).
 */

import type { LLMProvider } from './provider'
import { LLMError } from './types'
import type { LLMMessage, LLMOptions, LLMResponse } from './types'

const DEFAULT_MODEL = 'mimo-v2.5-pro'

export class MiMoProvider implements LLMProvider {
  readonly name = 'mimo'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    const key = apiKey ?? process.env.MIMO_API_KEY
    if (!key) {
      throw new LLMError(
        'MIMO_API_KEY missing. Add it to .env.local',
        'auth',
        'mimo',
        false
      )
    }
    this.apiKey = key.trim().replace(/^["']|["']$/g, '')
    this.baseUrl =
      baseUrl ??
      process.env.MIMO_BASE_URL ??
      'https://token-plan-sgp.xiaomimimo.com/v1'
  }

  async generate(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model ?? DEFAULT_MODEL
    const startedAt = Date.now()

    const body = {
        model,
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }]
            : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: options?.temperature ?? 0.3,
        max_completion_tokens: options?.maxTokens ?? 4000,
        top_p: 0.95,
        stream: false,
        frequency_penalty: 0,
        presence_penalty: 0,
        enable_thinking: false,
}

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.text()
        if (res.status === 429) {
          throw new LLMError(err, 'rate_limit', 'mimo', true)
        }
        if (res.status === 401) {
          throw new LLMError(`Invalid MIMO_API_KEY: ${err}`, 'auth', 'mimo', false)
        }
        throw new LLMError(err, 'server', 'mimo', true)
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>
        usage?: { prompt_tokens: number; completion_tokens: number }
      }

      const msg = data.choices[0]?.message as {
        content?: string
        reasoning_content?: string
      }
      // Prefer content over reasoning_content
      // If content is empty but reasoning_content exists, thinking mode leaked through
      const content = (msg?.content && msg.content.trim().length > 0)
  ? msg.content
  : (msg?.reasoning_content ?? '')
      return {
        content,
        model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        raw: data,
      }
    } catch (err) {
      if (err instanceof LLMError) throw err
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new LLMError(message, 'network', 'mimo', true)
    }
  }
}