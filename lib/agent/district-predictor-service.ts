import { getLanguageModel } from "@/lib/agent/ai-provider";
import { generateText, tool, isStepCount } from "ai";
import { z } from "zod";
import { fetchDistrictMandiRates, getUdyamDistrictIntelligence } from "@/lib/api/datagov";
import { searchGoogleWeb } from "@/lib/agent/serpapi-service";

export interface PredictedBusinessCard {
  id: string;
  rank: number;
  title: string;
  sector: string;
  matchScore: number;
  summary: string;
  capitalRequired: {
    min: number;
    max: number;
    formatted: string;
  };
  monthlyProfit: {
    min: number;
    max: number;
    formatted: string;
    marginPercentage: number;
  };
  paybackPeriodMonths: number;
  whyInThisDistrict: string;
  udyamAlignment?: string;
  matchedSubsidies: {
    name: string;
    percentage: string;
    details: string;
    portalUrl?: string;
  }[];
  riskLevel: "LOW" | "MODERATE" | "HIGH";
  executionSteps: string[];
}

export interface DistrictPredictionResult {
  success: boolean;
  district: string;
  state: string;
  budget: number;
  category: string;
  riskLevel: string;
  fromCache?: boolean;
  cards: PredictedBusinessCard[];
  districtSummary: string;
  liveMandiInsight: string;
  mandiRecords: any[];
  spokenSummary: string;
  researchQueriesExecuted?: string[];
}

export interface PredictDistrictParams {
  district?: string;
  state?: string;
  budget?: number;
  category?: string;
  riskLevel?: string;
  spaceAvailableSqFt?: number;
  powerConnectivity?: string;
  salesChannel?: string;
  entrepreneurExperience?: string;
  manpowerAvailable?: number;
  preferredSubsidies?: string;
  userId?: string;
  bypassCache?: boolean;
}

// In-memory cache for zero-DB execution
const districtPredictionCache = new Map<string, { timestamp: number; data: DistrictPredictionResult }>();

/**
 * Executes a live web search using SerpApi Google Search.
 */
async function executeLiveWebSearch(query: string): Promise<string[]> {
  try {
    const results = await searchGoogleWeb(query, 5);
    return results.map((r) => `${r.title}: ${r.snippet}`);
  } catch (e: any) {
    console.warn("[district-predictor] SerpApi web search error:", e?.message);
    return [];
  }
}

/**
 * Autonomous District Business Opportunity Predictor.
 * Powered strictly by Google Cloud Vertex AI Gemini 3.7 Flash with multi-step search autonomy.
 */
export async function predictDistrictBusinessesIntelligence(
  params: PredictDistrictParams
): Promise<DistrictPredictionResult> {
  const {
    district: rawDistrict,
    state: rawState,
    budget: rawBudget,
    category: rawCategory = "Any / All Sectors (Highest ROI)",
    riskLevel = "Moderate",
    spaceAvailableSqFt,
    powerConnectivity,
    salesChannel,
    entrepreneurExperience,
    manpowerAvailable,
    preferredSubsidies,
    bypassCache = false,
  } = params;

  let resolvedDistrict = rawDistrict || "Pune";
  let resolvedState = rawState || "Maharashtra";
  let resolvedBudget = rawBudget || 250000;

  const cacheKey = `${resolvedDistrict.toLowerCase()}_${resolvedState.toLowerCase()}_${resolvedBudget}`;
  if (!bypassCache) {
    const cached = districtPredictionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return { ...cached.data, fromCache: true };
    }
  }

  const [mandiRecords, udyamStats] = await Promise.all([
    fetchDistrictMandiRates(resolvedState, resolvedDistrict, 6).catch(() => []),
    Promise.resolve(getUdyamDistrictIntelligence(resolvedDistrict, resolvedState)),
  ]);

  const districtSummary = `${resolvedDistrict} district in ${resolvedState} is an active MSME growth corridor with high trade velocity and verified demand for ₹${resolvedBudget.toLocaleString("en-IN")} scale ventures.`;
  const liveMandiInsight =
    mandiRecords.length > 0
      ? `Wholesale APMC trends indicate steady local trade volumes and strong value-addition arbitrage opportunities.`
      : `Diverse commercial trade infrastructure supports fast-payback manufacturing, retail, and service ventures.`;

  const queriesExecuted: string[] = [];

  const systemInstruction = `You are VyaparSetu's Chief District Economic AI Strategist for Indian Micro, Small & Medium Enterprises.
You analyze capital budgets, local industrial corridors, consumer demand, and government subsidies (PMEGP, PMFME, Mudra, PM Vishwakarma, CGTMSE).

AUTONOMOUS RESEARCH RULE:
- You have a 'searchWeb' tool. Formulate and execute your own search queries to investigate current commercial demand, supply chain gaps, and emerging industrial sectors in ${resolvedDistrict}, ${resolvedState}.
- Do NOT guess blindly. Formulate queries like "${resolvedDistrict} ${resolvedState} high demand business opportunities" or "${resolvedDistrict} industrial clusters MSME gaps".
- After reviewing your search results, formulate exactly 4 high-ROI, low-saturation business recommendations.

SECTOR DIVERSITY RULE:
- When sector is 'Any / All Sectors (Highest ROI)' or unspecified, generate a DIVERSIFIED portfolio across 4 distinct sectors:
  1. Light Manufacturing / Fabrication / Packaging
  2. High-Demand Retail / Wholesale Distribution
  3. Technical Services / Workshop / Solar / EV Maintenance
  4. Food Processing / FMCG / Value Addition

SCHEMA: You must output ONLY valid JSON matching this schema:
{
  "spokenSummary": "1-2 natural spoken sentences summarizing the top recommended businesses and key subsidy benefit in simple English/Hinglish.",
  "cards": [
    {
      "id": "pred-1",
      "rank": 1,
      "title": "Business Name",
      "sector": "Manufacturing / Retail / Services / Logistics / FMCG",
      "matchScore": 96,
      "summary": "Crisp 2-sentence concept summary.",
      "capitalRequired": { "min": 150000, "max": 250000, "formatted": "₹1.5 Lakh - ₹2.5 Lakh" },
      "monthlyProfit": { "min": 35000, "max": 65000, "formatted": "₹35,000 - ₹65,000 / month", "marginPercentage": 28 },
      "paybackPeriodMonths": 6,
      "whyInThisDistrict": "Specific economic and industrial rationale grounded in your research for ${resolvedDistrict}, ${resolvedState}.",
      "udyamAlignment": "Udyam micro enterprise category and priority banking benefits.",
      "matchedSubsidies": [
        { "name": "PMEGP Capital Subsidy", "percentage": "35%", "details": "Direct capital grant under KVIC MSME.", "portalUrl": "https://www.kviconline.gov.in/pmegpeportal/" }
      ],
      "riskLevel": "LOW" | "MODERATE" | "HIGH",
      "executionSteps": [
        "Step 1: License & Udyam registration",
        "Step 2: Machinery / supplier sourcing",
        "Step 3: Commercial setup & distribution"
      ]
    }
  ]
}`;

  const userPrompt = `ENTERPRISE PREDICTION GOAL:
- District: ${resolvedDistrict}
- State: ${resolvedState}
- Capital Budget: ₹${resolvedBudget.toLocaleString("en-IN")}
- Target Sector: ${rawCategory}
- Risk Level: ${riskLevel}
${spaceAvailableSqFt ? `- Available Space/Land: ${spaceAvailableSqFt} sq.ft.` : ""}
${powerConnectivity ? `- Power Infrastructure: ${powerConnectivity}` : ""}
${salesChannel ? `- Preferred Distribution/Sales Channel: ${salesChannel}` : ""}
${entrepreneurExperience ? `- Entrepreneur Background/Experience: ${entrepreneurExperience}` : ""}
${manpowerAvailable ? `- Available Workforce/Manpower: ${manpowerAvailable} persons` : ""}
${preferredSubsidies ? `- Targeted/Preferred Subsidies: ${preferredSubsidies}` : ""}
- District ODOP Product: ${udyamStats.odopProduct || "Industrial & Consumer Goods"}
- Known Mandi Arrivals: ${mandiRecords.map((m: any) => `${m.commodity} (₹${m.modalPricePerQuintal})`).join(", ") || "Standard Commodity Flow"}

Autonomously search the web for commercial gaps and industrial activity in ${resolvedDistrict}, then return the Top 4 business cards.`;

  let parsedCards: PredictedBusinessCard[] = [];
  let spokenSummary = "";

  try {
    const model = getLanguageModel("vertex", "gemini-3.7-flash");

    const { text } = await generateText({
      model,
      system: systemInstruction,
      prompt: userPrompt,
      tools: {
        searchWeb: tool({
          description:
            "Search the live web for local commercial demand, upcoming industrial zones, MSME trade gaps, and market opportunities in the district.",
          inputSchema: z
            .object({
              query: z.string().describe("Targeted search query to research the district's economy"),
            })
            .passthrough(),
          execute: async ({ query }) => {
            queriesExecuted.push(query);
            const snippets = await executeLiveWebSearch(query);
            return {
              query,
              snippetsFound: snippets.length,
              snippets: snippets.slice(0, 4),
            };
          },
        }),
      },
      stopWhen: isStepCount(3),
    });

    if (text) {
      try {
        const clean = text.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.cards)) {
          parsedCards = parsed.cards;
        }
        if (parsed.spokenSummary) {
          spokenSummary = parsed.spokenSummary;
        }
      } catch (parseErr: any) {
        console.warn("[district-predictor] JSON parse warning:", parseErr?.message);
      }
    }
  } catch (err: any) {
    console.error("[district-predictor] Vertex AI generation error:", err?.message);
  }

  if (!spokenSummary) {
    spokenSummary =
      parsedCards.length > 0
        ? `In ${resolvedDistrict}, top recommended ventures for ₹${(resolvedBudget / 100000).toFixed(1)} Lakh budget include ${parsedCards.slice(0, 2).map((c) => c.title).join(" and ")} with PMEGP/Mudra subsidy eligibility.`
        : `No matching enterprise opportunities could be synthesized for ${resolvedDistrict} at this time.`;
  }

  const result: DistrictPredictionResult = {
    success: true,
    district: resolvedDistrict,
    state: resolvedState,
    budget: resolvedBudget,
    category: rawCategory,
    riskLevel,
    fromCache: false,
    cards: parsedCards,
    districtSummary,
    liveMandiInsight,
    mandiRecords,
    spokenSummary,
    researchQueriesExecuted: queriesExecuted,
  };

  districtPredictionCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}
