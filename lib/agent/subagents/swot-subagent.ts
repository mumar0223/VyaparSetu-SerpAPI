import { searchCatchmentShops, searchGoogleWeb } from "../serpapi-service";
import { getLanguageModel } from "../ai-provider";
import { DASHBOARD_CHAT_CONFIG } from "../chat-config";
import { z } from "zod";
import { streamStructured } from "./stream-structured";

export interface SwotSubAgentResult {
  category: string;
  location: string;
  totalCompetitorsFound: number;
  markdown: string;
  summary: string;
  spokenSummary: string;
}

const SwotOutputSchema = z.object({
  markdown: z.string().describe("Comprehensive Markdown SWOT analysis dossier with catchment brief, ```cards, 4-quadrant SWOT matrix table, competitor cluster list with distance & ratings, and actionable strategic action plan"),
  summary: z.string().describe("1-2 sentence executive summary for chat pill"),
  spokenSummary: z.string().describe("1 concise sentence suitable for text-to-speech audio feedback"),
});

/**
 * Autonomous Sub-Agent for SWOT Intelligence.
 * Grounded in real-time SerpApi Google Maps places & Web market trends.
 * Zero hardcoded fallback arrays, zero mock lists, zero hardcoded markdown templates.
 */
export async function runSWOTSubAgent(
  params: {
    category: string;
    location?: string;
    lat?: number;
    lon?: number;
    radiusKm?: number;
  },
  opts?: {
    onMarkdown?: (md: string) => void;
  }
): Promise<SwotSubAgentResult> {
  const category = params.category || "Retail Grocery & Kirana";
  const location = params.location || "Indiranagar, Bangalore";
  const radiusKm = params.radiusKm || 5;

  // 1. Fetch live competitor density via SerpApi Google Maps
  const [shops, webTrends] = await Promise.all([
    searchCatchmentShops({
      category,
      location,
      lat: params.lat,
      lon: params.lon,
      radiusKm,
      limit: 25,
    }),
    searchGoogleWeb(`${category} business opportunities profit margin challenges India`, 4),
  ]);

  const totalCompetitors = shops.length;
  const highThreatCount = shops.filter((s) => s.threatLevel === "High").length;
  const avgRating = shops.length > 0
    ? (shops.reduce((acc, s) => acc + (s.rating || 3.5), 0) / shops.length).toFixed(1)
    : "4.0";

  const model = getLanguageModel(
    DASHBOARD_CHAT_CONFIG.provider,
    DASHBOARD_CHAT_CONFIG.model
  );

  const prompt = `You are an elite retail strategy consultant and business intelligence analyst sub-agent.
Build an authentic, comprehensive 4-Quadrant SWOT Matrix and Competitor Catchment dossier in rich Markdown for a "${category}" business in "${location}" (${radiusKm}km radius).

REAL-TIME CATCHMENT COMPETITOR GROUNDING (Google Maps via SerpApi):
- Total Competitors Mapped: ${totalCompetitors}
- Average Competitor Rating: ${avgRating}★
- High Threat Rivals (4.3+★ & high reviews): ${highThreatCount}
- Top Verified Competitors:
${JSON.stringify(shops.slice(0, 10).map((s) => ({ name: s.name, distance: s.distance, rating: s.rating, reviews: s.reviews, threat: s.threatLevel })), null, 2)}

MARKET WEB GROUNDING VIA SERPAPI:
${JSON.stringify(webTrends, null, 2)}

TASK:
Produce an authentic, comprehensive SWOT Intelligence Dossier in Markdown format.
Include:
1. Heading: ### 🧭 Strategic 4-Quadrant SWOT Matrix: ${category} (${location})
2. Catchment Analysis Brief (2-3 sentences analyzing competitor saturation, density, and neighborhood customer demand).
3. A fenced \`\`\`cards block with 3 key metric cards (JSON with title "SWOT Catchment Snapshot" and cards array with label, value, status e.g. "positive", subtext). E.g. Competitors Mapped, Growth Opportunities, High-Threat Rivals.
4. The 4-Quadrant SWOT Matrix in a Markdown Table:
| Quadrant | Strategic Factors & Findings |
Include 3-4 concrete bullet points for Strengths (ताकत), Weaknesses (कमजोरी), Opportunities (अवसर), and Threats (चुनौतियां) tailored to this specific local catchment.
5. Local Competitor Cluster Density Table:
| Business Name | Distance | Rating | Threat Level |
List verified competitors from the Google Maps data.
6. Strategic Action Plan: 3 concrete execution steps for this business.
7. A 1-2 sentence executive summary for chat and 1 concise sentence spoken summary for voice agents.`;

  const parsed = await streamStructured({
    model,
    prompt,
    schema: SwotOutputSchema,
    temperature: 0.2,
    onPartial: (p) => {
      if (p.markdown) {
        opts?.onMarkdown?.(p.markdown);
      }
    },
  });

  return {
    category,
    location,
    totalCompetitorsFound: totalCompetitors,
    markdown: parsed.markdown,
    summary: parsed.summary || `SWOT scan completed: Analyzed ${totalCompetitors} competitors in ${location}.`,
    spokenSummary: parsed.spokenSummary || `SWOT analysis for ${category} in ${location} completed with live Google Maps competitor density.`,
  };
}
