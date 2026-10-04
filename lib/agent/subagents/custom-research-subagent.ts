import { searchGoogleWeb, GoogleWebResult } from "../serpapi-service";
import { getLanguageModel } from "../ai-provider";
import { DASHBOARD_CHAT_CONFIG } from "../chat-config";
import { z } from "zod";
import { streamStructured } from "./stream-structured";

export interface CustomResearchParams {
  tabTitle: string;
  category: string;
  query: string;
  icon?: string;
  spokenSummary?: string;
  investmentBudget?: number;
}

export interface CustomResearchResult {
  tabTitle: string;
  category: string;
  icon: string;
  summary: string;
  spokenSummary: string;
  markdown: string;
  sources: Array<{ title: string; url: string }>;
}

const CustomLlmSchema = z.object({
  markdown: z.string().describe("Complete Markdown content containing the cards, table, calculator, and checklist"),
  summary: z.string().describe("1-2 sentence executive summary for chat"),
  spokenSummary: z.string().describe("1 concise sentence suitable for text-to-speech audio feedback"),
});

/**
 * Autonomous Sub-Agent for On-Demand Custom Domain Research.
 * Enables the Head AI to awaken dynamic sub-agents for unmapped domains
 * (e.g. Cold Storage, FSSAI / APEDA Export, Packaging Automation, Solar Rooftop, Bio-fertilizer capex)
 * with 100% SerpApi Google Search web grounding and interactive calculator sliders.
 */
export async function runCustomResearchSubAgent(
  params: CustomResearchParams,
  opts?: {
    onMarkdown?: (md: string) => void;
  }
): Promise<CustomResearchResult> {
  const tabTitle = params.tabTitle || "🔍 Specialized Research";
  const category = params.category || "Commercial Domain";
  const icon = params.icon || "factory";
  const query = params.query || `${category} business setup cost subsidy checklist India 2025`;

  // 1. Live Web Grounding via SerpApi Google Search
  const serpResults = await searchGoogleWeb(query, 6);
  const sources = serpResults
    .filter((r) => r.url && r.title)
    .map((r) => ({ title: r.title, url: r.url }))
    .slice(0, 5);

  const webGroundingContext = serpResults
    .map((r, i) => `[Source ${i + 1} - ${r.title}] (${r.url})\n${r.snippet}`)
    .join("\n\n");

  try {
    const model = getLanguageModel(
      DASHBOARD_CHAT_CONFIG.provider,
      DASHBOARD_CHAT_CONFIG.model
    );

    const prompt = `You are a Tier-1 Indian Industrial & Commercial Research Sub-Agent specializing in: "${category}".
A user is requesting deep, verified operational and financial intelligence for: "${tabTitle}".

REAL-TIME WEB GROUNDING VIA SERPAPI GOOGLE SEARCH:
${webGroundingContext || "No live web search results available. Rely on standard Indian statutory & MSME benchmarks."}

TASK:
Produce an authentic, highly actionable Stage Document dossier in Markdown format.
Include:
1. Executive Brief with strategic context.
2. A fenced \`\`\`cards block containing 3 to 4 concise metrics (Cards JSON format with title and cards array containing label, value, status, subtext).
3. A structured Markdown comparison table (e.g. Capex Breakdown, Machinery Specifications, or Phased Compliance Milestones). If comparing numerical costs or equipment tiers, you may also include a fenced \`\`\`chart block with JSON (never use mermaid for charts).
4. An interactive formula simulator fenced in a \`\`\`calculator block.
   - The calculator JSON must have "title", "description", "inputs" (array of sliders or selectors with id, label, type, min, max, step, defaultValue, unit), and "outputs" (array of formulas using input ids, format e.g. "currency" or "percentage", highlight: true).
5. Phased implementation checklist with statutory portal links and DPR documentation requirements.
6. A 1-sentence spoken summary for the voice agent.`;

    const parsed = await streamStructured({
      model,
      prompt,
      schema: CustomLlmSchema,
      temperature: 0.2,
      onPartial: (p) => {
        if (p.markdown) {
          opts?.onMarkdown?.(p.markdown);
        }
      },
    });

    return {
      tabTitle,
      category,
      icon,
      summary: parsed.summary || `Specialized research dossier compiled for ${tabTitle}.`,
      spokenSummary: parsed.spokenSummary || params.spokenSummary || `I've prepared a comprehensive research tab on ${tabTitle} with live market data and interactive cost sliders.`,
      markdown: parsed.markdown,
      sources,
    };
  } catch (err: any) {
    console.error("[custom-research-subagent] Research generation failed:", err);
    throw err;
  }
}
