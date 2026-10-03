import { getLanguageModel } from "@/lib/agent/ai-provider";
import { generateText } from "ai";

export interface OndcProcurementItem {
  commodity: string;
  traditionalMarginPercent: string;
  ondcWholesaleDiscountPercent: string;
  estimatedMonthlySavingsInr: number;
  topB2bNetworks: string[];
}

export interface OndcSellerPlatform {
  platformName: string;
  commissionRate: string;
  buyerNetworkReach: string[];
  bestFor: string;
}

export interface OndcIntelligenceData {
  procurement: OndcProcurementItem[];
  sellerPlatforms: OndcSellerPlatform[];
  logisticsPartners: string[];
  commissionComparison: {
    traditionalAggregatorRate: string;
    ondcCommissionRate: string;
    monthlyMarginBoostPercent: string;
  };
  recommendedActions: string[];
}

export interface OndcIntelligenceResult {
  success: boolean;
  needsLocation?: boolean;
  message?: string;
  category?: string;
  location?: string;
  targetBusinessName?: string;
  fromCache?: boolean;
  data: OndcIntelligenceData;
  summary: string;
  spokenSummary: string;
}

export interface GetOndcParams {
  category?: string;
  location?: string;
  intent?: "procure" | "sell" | "logistics" | "general";
  userId?: string;
  businessName?: string;
  bypassCache?: boolean;
}

// In-memory cache for zero-DB execution
const ondcCache = new Map<string, { timestamp: number; data: OndcIntelligenceResult }>();

/**
 * Discovers and formats ONDC Digital Commerce intelligence for any enterprise.
 * Uses Google Cloud Vertex AI Gemini 3.7 Flash.
 */
export async function getOndcIntelligence(
  params: GetOndcParams
): Promise<OndcIntelligenceResult> {
  const {
    category: rawCategory,
    location: rawLocation,
    intent = "general",
    businessName: rawBusinessName,
    bypassCache = false,
  } = params;

  let resolvedCategory = rawCategory || "Retail & Local Commerce";
  let resolvedLocation = rawLocation || "Local Trade Hub, India";
  let resolvedBusinessName = rawBusinessName || "My Enterprise";

  const cacheKey = `${resolvedCategory.toLowerCase()}_${resolvedLocation.toLowerCase()}_${intent}`;
  if (!bypassCache) {
    const cached = ondcCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return { ...cached.data, fromCache: true };
    }
  }

  try {
    const model = getLanguageModel("vertex", "gemini-3.7-flash");

    const systemPrompt = `You are VyaparSetu's Chief ONDC (Open Network for Digital Commerce) Trade Architect for Indian Micro/Small Enterprises.
You analyze how local Indian merchants can leverage ONDC for:
1. B2B Wholesale Procurement: Sourcing raw materials, inventory, and packaging at direct manufacturer/mandi wholesale rates with zero intermediary cut.
2. B2C Digital Selling: Onboarding onto ONDC seller apps (e.g. Mystore, Magicpin, SellerApp, PayTM) to access millions of buyers on Pincode, Paytm, Ola, and Mystore buyer apps at only 3-5% commission (vs 25-30% on legacy aggregators like Swiggy/Zomato/Amazon).
3. Hyper-Local Logistics: Connecting with integrated on-demand delivery partners (Shadowfax, Dunzo, Shiprocket).

Return ONLY pure valid JSON with no markdown wrapping.`;

    const userPrompt = `ENTERPRISE PROFILE FOR ONDC INTEGRATION:
- Enterprise Name: ${resolvedBusinessName}
- Category / Trade: ${resolvedCategory}
- Geographic Location: ${resolvedLocation}
- Primary Intent: ${intent.toUpperCase()}

Generate a concrete, high-ROI ONDC roadmap in this EXACT JSON schema:
{
  "summary": "2-sentence executive summary of the financial upside of ONDC for this business in ${resolvedLocation}.",
  "spokenSummary": "1-2 natural spoken sentences in simple English or Hinglish highlighting key savings (e.g. 'You can save 8-12% on wholesale procurement on ONDC B2B and sell with only 3% commission on Mystore/Magicpin.').",
  "procurement": [
    {
      "commodity": "Name of raw material / wholesale stock (e.g. Edible Oil, Spices, Pulses, Packaging Boxes, Grain Sacks)",
      "traditionalMarginPercent": "e.g. 14-18% distributor markup",
      "ondcWholesaleDiscountPercent": "e.g. 8-12% direct factory savings",
      "estimatedMonthlySavingsInr": 12500,
      "topB2bNetworks": ["B2B Seller Network 1", "B2B Seller Network 2"]
    }
  ],
  "sellerPlatforms": [
    {
      "platformName": "Mystore / Magicpin / SellerApp / PayTM",
      "commissionRate": "3.5% per order",
      "buyerNetworkReach": ["Pincode by PhonePe", "Paytm", "Ola", "Mystore"],
      "bestFor": "Direct catalogue listing for ${resolvedCategory}"
    }
  ],
  "logisticsPartners": [
    "Shadowfax Local Express",
    "Dunzo for Business",
    "Shiprocket Quick"
  ],
  "commissionComparison": {
    "traditionalAggregatorRate": "25% - 30% per order",
    "ondcCommissionRate": "3% - 5% per order",
    "monthlyMarginBoostPercent": "+18% to +22% retained gross margin"
  },
  "recommendedActions": [
    "Register GST / Udyam credentials on an ONDC seller app (Mystore or Magicpin)",
    "Upload top 15 fastest-moving inventory items with digital product photos and retail prices",
    "Link existing UPI merchant VPA for T+1 automated payment settlements directly into bank account"
  ]
}`;

    const aiResult = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    let parsed: any = null;
    if (aiResult.text) {
      try {
        const clean = aiResult.text
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/gi, "")
          .trim();
        parsed = JSON.parse(clean);
      } catch (parseErr: any) {
        console.warn("[ondc-service] JSON parse error:", parseErr?.message);
      }
    }

    if (!parsed || !Array.isArray(parsed.procurement)) {
      parsed = {
        summary: `ONDC enables ${resolvedBusinessName} in ${resolvedLocation} to source wholesale inventory 8-12% cheaper and sell directly at 3% commission.`,
        spokenSummary: `Aap ONDC B2B se direct wholesale stock procure karke lagbhag 10% bacha sakte hain aur Mystore ke zariye 3% commission me online bech sakte hain.`,
        procurement: [
          {
            commodity: `Core ${resolvedCategory} Wholesale Stock & Packaging`,
            traditionalMarginPercent: "15% distributor markup",
            ondcWholesaleDiscountPercent: "9% direct factory savings",
            estimatedMonthlySavingsInr: 15000,
            topB2bNetworks: ["ONDC B2B Wholesale Yard", "Agri-Trade Digital Exchange"],
          },
        ],
        sellerPlatforms: [
          {
            platformName: "Mystore",
            commissionRate: "3.5% per order",
            buyerNetworkReach: ["Pincode", "Paytm", "Ola"],
            bestFor: "Fast catalogue setup with zero upfront fee",
          },
          {
            platformName: "Magicpin",
            commissionRate: "4.0% per order",
            buyerNetworkReach: ["Paytm", "PhonePe Pincode"],
            bestFor: "Hyper-local neighbourhood customer delivery",
          },
        ],
        logisticsPartners: ["Shadowfax Local Express", "Dunzo for Business", "Shiprocket Quick"],
        commissionComparison: {
          traditionalAggregatorRate: "25% - 30%",
          ondcCommissionRate: "3% - 5%",
          monthlyMarginBoostPercent: "+20% retained margin",
        },
        recommendedActions: [
          "Onboard on Mystore or Magicpin seller app using Udyam registration",
          "List top 10 best-selling items at competitive local prices",
          "Enable instant UPI settlement directly to bank account",
        ],
      };
    }

    const outputData: OndcIntelligenceData = {
      procurement: parsed.procurement || [],
      sellerPlatforms: parsed.sellerPlatforms || [],
      logisticsPartners: parsed.logisticsPartners || [],
      commissionComparison: parsed.commissionComparison || {
        traditionalAggregatorRate: "25% - 30%",
        ondcCommissionRate: "3% - 5%",
        monthlyMarginBoostPercent: "+20% retained margin",
      },
      recommendedActions: parsed.recommendedActions || [],
    };

    const result: OndcIntelligenceResult = {
      success: true,
      fromCache: false,
      category: resolvedCategory,
      location: resolvedLocation,
      targetBusinessName: resolvedBusinessName,
      data: outputData,
      summary: parsed.summary,
      spokenSummary: parsed.spokenSummary,
    };

    ondcCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err: any) {
    console.error("[ondc-service] Generation error:", err);
    return {
      success: false,
      message: `Failed to generate ONDC intelligence: ${err?.message}`,
      category: resolvedCategory,
      location: resolvedLocation,
      data: {
        procurement: [],
        sellerPlatforms: [],
        logisticsPartners: [],
        commissionComparison: {
          traditionalAggregatorRate: "28%",
          ondcCommissionRate: "3.5%",
          monthlyMarginBoostPercent: "+20%",
        },
        recommendedActions: [],
      },
      summary: "ONDC service encountered an error.",
      spokenSummary: "Could not retrieve ONDC details at this moment.",
    };
  }
}
