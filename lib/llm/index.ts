/**
 * Single entry point for LLM access.
 * Provider chosen via LLM_PROVIDER env var ('gemini' | 'groq').
 * Default: gemini.
 */

import type { LLMProvider } from './provider'
import { GeminiProvider } from './gemini'
import { GroqProvider } from './groq'
import { MiMoProvider } from './mimo'

export type { LLMMessage, LLMOptions, LLMResponse } from './types'
export { LLMError } from './types'
export type { LLMProvider } from './provider'

let providerInstance: LLMProvider | null = null

export function getLLM(): LLMProvider {
  if (!providerInstance) {
    const choice = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase()
    if (choice === 'groq') {
      providerInstance = new GroqProvider()
    } else if (choice === 'mimo') {
      providerInstance = new MiMoProvider()
    } else {
      providerInstance = new GeminiProvider()
    }
  }
  return providerInstance
}

export function resetLLM(): void {
  providerInstance = null
}