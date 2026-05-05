import { getLLM } from "@/lib/llm"
import { KEYWORD_EXTRACTION_PROMPT } from "../prompts"

export async function extractKeywords(
    deidentifiedTranscript: string
): Promise<{ keywords: string[]; tokensUsed: number; latencyMs: number }> {
    const llm = getLLM()

    const response = await llm.generate(
        [{ role: "user", content: deidentifiedTranscript }],
        {
            model: "gemini-2.5-flash",
            systemPrompt: KEYWORD_EXTRACTION_PROMPT,
            temperature: 0.1,
            maxTokens: 200,
            thinkingBudget: 0
        }
    )

    const keywords = parseKeywords(response.content)

    return {
        keywords,
        tokensUsed: response.inputTokens + response.outputTokens,
        latencyMs: response.latencyMs
    }
}

function parseKeywords(raw: string): string[] {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    }
    try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
            return parsed
        }
        return []
    } catch {
        return []
    }
}