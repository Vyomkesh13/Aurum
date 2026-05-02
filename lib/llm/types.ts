
/**
 *Shared types for the llm abstraction layer.
 Provider-agnostic - works for gemini , claude, openai etc.
 
 */
// A single message in a conversation.
// Mirrors the role+content pattern used by every major LLM API.

export type LLMMessage = {
    role : 'system' | 'user' | 'assistant'
    content: string

}
// A single message in a conversation.
// Mirrors the role+content pattern used by every major LLM API.

export type LLMOptions = {
    model?: string
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
    thinkingBudget?: number   // 0 = disable thinking, -1 = dynamic, >0 = max thinking tokens
}
// What every LLM call returns.
// Includes content + metadata for our audit log

export type LLMResponse = {
    content:string
    model:string
    inputTokens:number
    outputTokens:number
    latencyMs:number
    raw?: unknown
}

// Errors that providers can throw.
// Standardized so the pipeline can handle them uniformly.

export class LLMError extends Error{
    constructor(
        message:string,
        public code: 'rate_limit' | 'auth' | 'invalid_request' | 'server' | 'network' | 'unknown',
        public provider:string,
        public retryable:boolean
    )
    {
        super(message)
        this.name = 'LLMError'
    }
}
