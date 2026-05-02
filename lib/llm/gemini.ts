import { GoogleGenAI } from '@google/genai'
import type { LLMProvider } from './provider'
import { LLMError } from './types'
import type { LLMMessage, LLMOptions, LLMResponse } from './types'

// Default model for general-purpose calls.
// Reasoning-critical pipeline stages override this.
const DEFAULT_MODEL = 'gemini-2.5-flash'

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini'

  private client: GoogleGenAI

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY
    if (!key) {
      throw new LLMError(
        'GEMINI_API_KEY is missing. Add it to .env.local',
        'auth',
        'gemini',
        false
      )
    }
    this.client = new GoogleGenAI({ apiKey: key })
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const model = options?.model ?? DEFAULT_MODEL
    const startedAt = Date.now()

    // Translate our messages -> Gemini's expected shape.
    // Gemini uses 'contents' with role 'user' or 'model' (not 'assistant').
    // System messages are passed separately as systemInstruction.
    const systemInstruction =
      options?.systemPrompt ??
      messages.find((m) => m.role === 'system')?.content

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    try {
      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
          thinkingConfig:
            options?.thinkingBudget !== undefined
              ? { thinkingBudget: options.thinkingBudget }
              : undefined,
        },
      })

      const content = response.text ?? ''
      const usage = response.usageMetadata

      return {
        content,
        model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        latencyMs: Date.now() - startedAt,
        raw: response,
      }
    } catch (err: unknown) {
      throw this.translateError(err)
    }
  }

  /**
   * Convert any thrown error into a standardized LLMError.
   * Caller can switch on code and decide whether to retry.
   */
  private translateError(err: unknown): LLMError {
    const message =
      err instanceof Error ? err.message : 'Unknown Gemini error'

    // Gemini SDK errors typically include status codes in the message.
    // We do best-effort classification here.
    if (/api[_ ]?key|unauthorized|permission/i.test(message)) {
      return new LLMError(message, 'auth', 'gemini', false)
    }
    if (/rate|quota|429/i.test(message)) {
      return new LLMError(message, 'rate_limit', 'gemini', true)
    }
    if (/invalid|400/i.test(message)) {
      return new LLMError(message, 'invalid_request', 'gemini', false)
    }
    if (/5\d\d|server|unavailable/i.test(message)) {
      return new LLMError(message, 'server', 'gemini', true)
    }
    if (/network|fetch|timeout|econnrefused/i.test(message)) {
      return new LLMError(message, 'network', 'gemini', true)
    }
    return new LLMError(message, 'unknown', 'gemini', false)
  }
}