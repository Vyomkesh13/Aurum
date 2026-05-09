/**
 * Groq provider — concrete implementation of LLMProvider.
 * Wraps groq-sdk. Uses Llama 3.3 70B by default for reasoning quality.
 */

import Groq from 'groq-sdk'
import type { LLMProvider } from './provider'
import { LLMError } from './types'
import type { LLMMessage, LLMOptions, LLMResponse } from './types'

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export class GroqProvider implements LLMProvider {
  readonly name = 'groq'

  private client: Groq

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GROQ_API_KEY
    if (!key) {
      throw new LLMError(
        'GROQ_API_KEY is missing. Add it to .env.local',
        'auth',
        'groq',
        false
      )
    }
    this.client = new Groq({ apiKey: key })
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    // If caller passed a Gemini-style model name, fall back to Groq default.
        const requestedModel = options?.model
        const model =
            requestedModel && !requestedModel.startsWith('gemini')
                ? requestedModel
                : DEFAULT_MODEL
        const startedAt = Date.now()

    // Translate our messages -> Groq's OpenAI-style chat shape.
    // Groq supports system/user/assistant directly — closer mapping than Gemini.
    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    // Prepend system prompt if provided via options
    if (options?.systemPrompt) {
      groqMessages.push({ role: 'system', content: options.systemPrompt })
    }
    for (const m of messages) {
      groqMessages.push({ role: m.role, content: m.content })
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: groqMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        // Groq doesn't have thinking_budget — silently ignore that option.
      })

      const content = response.choices[0]?.message?.content ?? ''
      const usage = response.usage

      return {
        content,
        model,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        raw: response,
      }
    } catch (err: unknown) {
      throw this.translateError(err)
    }
  }

  private translateError(err: unknown): LLMError {
    const message = err instanceof Error ? err.message : 'Unknown Groq error'

    if (/api[_ ]?key|unauthorized|401/i.test(message)) {
      return new LLMError(message, 'auth', 'groq', false)
    }
    if (/rate|quota|429|too many/i.test(message)) {
      return new LLMError(message, 'rate_limit', 'groq', true)
    }
    if (/invalid|400|bad request/i.test(message)) {
      return new LLMError(message, 'invalid_request', 'groq', false)
    }
    if (/5\d\d|server|unavailable/i.test(message)) {
      return new LLMError(message, 'server', 'groq', true)
    }
    if (/network|fetch|timeout|econnrefused/i.test(message)) {
      return new LLMError(message, 'network', 'groq', true)
    }
    return new LLMError(message, 'unknown', 'groq', false)
  }
}