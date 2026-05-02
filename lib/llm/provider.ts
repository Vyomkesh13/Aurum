import type { LLMMessage, LLMOptions, LLMResponse } from './types'

export interface LLMProvider {
  /**
   * The provider's name (e.g. 'gemini', 'claude', 'openai').
   * Used for logging and audit trails.
   */
  readonly name: string

  /**
   * Generate a response from a list of messages.
   *
   * @param messages   The conversation history in chronological order.
   * @param options    Optional per-call settings (model, temperature, etc).
   * @returns          Standardized response with content + metadata.
   * @throws LLMError  On any failure — caller decides whether to retry.
   */
  generate(
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<LLMResponse>
}