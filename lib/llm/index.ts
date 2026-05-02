import type { LLMProvider } from './provider'
import { GeminiProvider } from './gemini'

// Re-export types so callers only import from '@/lib/llm'.
export type { LLMMessage, LLMOptions, LLMResponse } from './types'
export { LLMError } from './types'
export type { LLMProvider } from './provider'

// Module-level singleton — created once, reused across the app.
let providerInstance: LLMProvider | null = null

/**
 * Get the configured LLM provider (singleton).
 * Lazy-initialized on first call.
 */
export function getLLM(): LLMProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider()
  }
  return providerInstance
}

/**
 * Reset the singleton — useful in tests or when rotating credentials.
 */
export function resetLLM(): void {
  providerInstance = null
}