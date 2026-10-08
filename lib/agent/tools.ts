import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types";
import { chatStore } from "@/lib/storage/chat-store";
import {
  normalizeCommodity,
  normalizeDistrictAndState,
  searchLiveMandiWebRates,
} from "./mandi-normalizer";
import { searchCompetitorsIntelligence } from "./competitor-service";
import { getOndcIntelligence } from "./ondc-service";
import { predictDistrictBusinessesIntelligence } from "./district-predictor-service";
import {
  searchGoogleWeb,
  searchCatchmentShops,
  searchGoogleNews,
} from "./serpapi-service";
import { runCreditEMISubAgent } from "./subagents/credit-emi-subagent";
import { runSWOTSubAgent } from "./subagents/swot-subagent";
import { runMandiSubAgent } from "./subagents/mandi-subagent";
import { runSchemesSubAgent } from "./subagents/schemes-subagent";
import { runCustomResearchSubAgent } from "./subagents/custom-research-subagent";
import { stableMarkdown } from "./subagents/stream-structured";

/**
 * Zod Schemas for Tools
 */

const MandiRatesSchema = z
  .object({
    commodity: z
      .string()
      .optional()
      .describe(
        "Crop or commodity name in English or Hindi, e.g. Wheat (गेहूं), Mustard (सरसों), Onion (प्याज), Paddy (धान), Potato (आलू), Soybean (सोयाबीन), Tomato (टमाटर), Gram (चना), Cotton (कपास), Sugarcane (गन्ना)",
      ),
    state: z
      .string()
      .optional()
      .describe(
        "State filter, e.g. Uttar Pradesh (UP), Madhya Pradesh (MP), Maharashtra, Gujarat, Punjab, Rajasthan, Haryana, Bihar",
      ),
    district: z
      .string()
      .optional()
      .describe(
        "District or city filter, e.g. Gorakhpur, Varanasi, Indore, Nashik, Pune, Lucknow, Kanpur, Prayagraj, Patna, Jaipur",
      ),
    market: z
      .string()
      .optional()
      .describe(
        "Specific APMC Mandi e.g. Gorakhpur Mandi, Lasalgaon, Azadpur, Indore APMC",
      ),
    variety: z
      .string()
      .optional()
      .describe(
        "Specific crop variety (e.g. 'Lokwan', 'Sharbati', 'Desi', 'Hybrid', 'Red Onion', 'White Onion', 'Yellow Soybean')",
      ),
    grade: z
      .string()
      .optional()
      .describe("Produce quality grade (e.g. 'FAQ', 'Grade A', 'Super', 'Medium')"),
    query: z
      .string()
      .optional()
      .describe("Optional free-form rate inquiry or specific market yard search"),
  })
  .passthrough();

const WebSearchSchema = z
  .object({
    query: z
      .string()
      .describe(
        "Search query for live trade, market policy, tax circulars, or business information",
      ),
    numResults: z
      .number()
      .optional()
      .default(5)
      .describe("Number of search results to return"),
    focusDomain: z
      .string()
      .optional()
      .describe("Optional domain to focus search (e.g. 'gov.in', 'rbi.org.in', 'cbic.gov.in')"),
  })
  .passthrough();

const SearchCompetitorsSchema = z
  .object({
    query: z
      .string()
      .optional()
      .describe(
        "Optional query or description of the target business or trade sector to search",
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Business sector or category, e.g. 'Biryani & Food Outlets', 'Kirana / Grocery', 'Automobile Parts', 'Textiles'",
      ),
    radiusKm: z
      .number()
      .optional()
      .default(5)
      .describe("Catchment radius in kilometers to scan (e.g. 1, 2, 5, 10)"),
    location: z
      .string()
      .optional()
      .describe(
        "Specific street, area, market yard, or city if provided by user",
      ),
    lat: z.number().optional().describe("Latitude coordinate if available"),
    lon: z.number().optional().describe("Longitude coordinate if available"),
    userBusinessName: z
      .string()
      .optional()
      .describe("User's own business name to benchmark directly against competitors"),
    priceTier: z
      .enum(["Budget", "Mid-Range", "Premium", "All"])
      .optional()
      .describe("Target price/customer segment filter"),
    bypassCache: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to bypass DB cache"),
  })
  .passthrough();

const OndcIntelligenceSchema = z
  .object({
    query: z
      .string()
      .optional()
      .describe(
        "Specific ONDC inquiry e.g. 'How to sell on ONDC', 'Bulk raw material sourcing', or 'Logistics integration'",
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Business trade category e.g. 'Biryani & Food Outlets', 'Kirana', 'Apparel', 'Agro-processing'",
      ),
    location: z.string().optional().describe("City, district or state location"),
    pincode: z
      .string()
      .optional()
      .describe("6-digit postal pincode for hyper-local delivery provider lookup"),
    currentSalesChannels: z
      .string()
      .optional()
      .describe(
        "Current sales channels (e.g. 'Offline counter only', 'Zomato/Swiggy 28%', 'Amazon 22%') for commission comparison",
      ),
    monthlyVolume: z
      .string()
      .optional()
      .describe(
        "Order volume or turnover (e.g. '30 orders/day', '₹2 Lakhs/month', '5 tonnes') to negotiate bulk wholesale discounts",
      ),
    hasGst: z
      .boolean()
      .optional()
      .describe(
        "Whether enterprise holds GSTIN (ONDC allows non-GST sellers for intra-state/local commerce)",
      ),
    intent: z
      .enum(["procure", "sell", "logistics", "general"])
      .optional()
      .default("general")
      .describe(
        "Focus area: procure (buy cheaper), sell (list catalog), logistics, or general",
      ),
    bypassCache: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to force a fresh re-evaluation bypassing DB cache"),
  })
  .passthrough();

const PredictDistrictBusinessesSchema = z
  .object({
    district: z
      .string()
      .optional()
      .describe(
        "District or city to evaluate (e.g. Lucknow, Varanasi, Pune, Indore, Kanpur)",
      ),
    state: z
      .string()
      .optional()
      .describe(
        "State name (e.g. Uttar Pradesh, Maharashtra, Madhya Pradesh, Gujarat)",
      ),
    budget: z
      .number()
      .optional()
      .describe("Capital investment budget in INR (e.g. 150000, 300000, 500000)"),
    category: z
      .string()
      .optional()
      .describe(
        "Specific sector or trade interest (e.g. Food Processing, Packaging, Manufacturing, Retail, Technical Services)",
      ),
    riskLevel: z
      .enum(["Low", "Moderate", "High"])
      .optional()
      .default("Moderate")
      .describe("Risk tolerance for the venture"),
    spaceAvailableSqFt: z
      .number()
      .optional()
      .describe("Commercial or industrial floor space available in sq ft (e.g. 200, 1000, 5000)"),
    powerConnectivity: z
      .enum(["Single_Phase_Domestic", "Three_Phase_Commercial", "High_Tension_Industrial"])
      .optional()
      .describe("Available power supply infrastructure"),
    salesChannel: z
      .enum(["Local_Retail", "B2B_Wholesale", "Ecommerce_ONDC", "Export"])
      .optional()
      .describe("Primary intended customer channel"),
    entrepreneurExperience: z
      .string()
      .optional()
      .describe("Applicant's background or prior business experience"),
    manpowerAvailable: z
      .number()
      .optional()
      .describe("Number of workers/staff readily available or intended to hire"),
    preferredSubsidies: z
      .string()
      .optional()
      .describe("Specific subsidies user is interested in (e.g. PMEGP, PMFME, PM Surya Ghar, Mudra)"),
    bypassCache: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to force fresh live web search and bypass DB cache"),
  })
  .passthrough();

const SchemeEligibilitySchema = z
  .object({
    schemeName: z
      .string()
      .describe(
        "Name of the government credit, subsidy, or grant scheme to evaluate (e.g. Mudra, PMEGP, PM SVANidhi, Stand-Up India, PMFME, KCC, CGTMSE, or State subsidy)",
      ),
    query: z
      .string()
      .optional()
      .describe(
        "Specific user question or focus area (e.g. 'subsidy for women', 'documents needed', 'machinery loan limit', 'interest subvention')",
      ),
    businessSector: z
      .string()
      .optional()
      .describe(
        "Business trade or manufacturing category (e.g. Textiles, Food Processing, Kirana, Metal Fabrication)",
      ),
    state: z
      .string()
      .optional()
      .describe(
        "State or UT (crucial for state-specific subsidies like UP ODOP, MP Udyami, and regional margin money)",
      ),
    district: z
      .string()
      .optional()
      .describe(
        "District or city (for DIC nodal office linkage and cluster schemes)",
      ),
    applicantCategory: z
      .string()
      .optional()
      .describe(
        "Beneficiary demographic group: General, Women, SC/ST, OBC, Minority, Ex-Serviceman (qualifies for 25%-35% subsidy)",
      ),
    areaType: z
      .enum(["Rural", "Urban", "Semi-Urban"])
      .optional()
      .describe("Rural vs Urban location (affects subsidy tier in PMEGP and PMFME)"),
    loanAmountRequested: z
      .number()
      .optional()
      .describe("Requested loan or project cost in INR"),
    annualTurnover: z
      .number()
      .optional()
      .describe("Annual sales/turnover in INR"),
    businessStage: z
      .enum(["New", "Expansion", "Modernization"])
      .optional()
      .describe("New project setup vs existing enterprise expansion"),
  })
  .passthrough();



export const StageFormFieldSchema = z
  .object({
    id: z
      .string()
      .describe(
        "Unique field key/id (e.g. 'fullName', 'loanAmount', 'businessType', 'purpose')",
      ),
    label: z
      .string()
      .describe(
        "Field display label (e.g. 'Applicant Full Name (आवेदक का पूरा नाम)')",
      ),
    type: z
      .string()
      .default("text")
      .describe("Input field type (text, number, select, date, textarea, checkbox, phone, email, etc.)"),
    defaultValue: z
      .any()
      .optional()
      .describe("Default or suggested pre-filled value"),
    value: z.any().optional().describe("Current pre-filled value"),
    placeholder: z.string().optional().describe("Helpful placeholder text"),
    options: z
      .array(z.string())
      .optional()
      .describe("List of options for 'select' dropdown type"),
    required: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether the field is mandatory"),
    helpText: z
      .string()
      .optional()
      .describe("Optional brief description or note under the input"),
    colSpan: z
      .number()
      .optional()
      .describe(
        "Number of columns this field spans (e.g. 1 or 2 for full width in a 2-col section)",
      ),
    displayVariant: z
      .string()
      .optional()
      .describe(
        "Layout styling: 'fill_line' (underlined line), 'character_boxes' / 'char_boxes' (discrete boxes for PAN/Aadhaar/IFSC), 'boxed', 'table_cell'",
      ),
    suffix: z
      .string()
      .optional()
      .describe("Unit or suffix, e.g. '₹', 'Years', '%'"),
  })
  .passthrough();

export const StageFormRowSchema = z
  .object({
    fields: z
      .array(StageFormFieldSchema)
      .min(1)
      .describe(
        "Fields sitting together on this line (1, 2, or 3 fields in a row)",
      ),
  })
  .passthrough();

export const StageFormTableSchema = z
  .object({
    headers: z
      .array(z.string())
      .describe(
        "Table column headers (e.g. ['क्रमांक', 'शैक्षिक योग्यता', 'उत्तीर्ण वर्ष', 'पूर्णांक', 'प्राप्तांक', 'प्रतिशत', 'बोर्ड'])",
      ),
    rows: z
      .array(z.array(z.union([z.string(), z.number()])))
      .describe("Array of table row cell values"),
  })
  .passthrough();

export const StageFormSectionSchema = z
  .object({
    title: z
      .string()
      .optional()
      .describe(
        "Clean plain section heading (e.g. '1. Branch Particulars', '2. Applicant & Promoter Identity', '3. Credit Facility Request'). NEVER use brackets, pipes, dashes or decorative symbols like '—[ ... ]—' or '|-'.",
      ),
    description: z
      .string()
      .optional()
      .describe("Brief subtitle or description for this section"),
    columns: z
      .number()
      .optional()
      .default(2)
      .describe("Default column count for the section (1, 2, or 3)"),
    photoBox: z
      .object({
        label: z
          .string()
          .optional()
          .default("फ़ोटो / Passport Photo")
          .describe("Photo box label"),
        url: z.string().optional().describe("Optional photo URL if available"),
      })
      .passthrough()
      .optional()
      .describe("Optional passport photo box on the right of the section"),
    rows: z
      .array(StageFormRowSchema)
      .optional()
      .describe("List of rows in this section. Each row holds 1, 2, or 3 fields"),
    table: StageFormTableSchema.optional().describe(
      "Optional embedded sub-table for qualifications, marksheets, or financial breakdown",
    ),
    fields: z
      .array(StageFormFieldSchema)
      .optional()
      .describe("Fallback flat list of fields in this section"),
  })
  .passthrough();

export const StageFormThemeSchema = z
  .object({
    primaryColor: z
      .string()
      .optional()
      .describe(
        "Bank/Scheme brand color (e.g. '#1E3A8A' for SBI, '#15803D' for Agriculture, '#C2410C' for PMEGP)",
      ),
    pageBg: z
      .string()
      .optional()
      .describe("Paper sheet background tint (e.g. '#FFFFFF', '#FAF8F5')"),
    borderColor: z
      .string()
      .optional()
      .describe("Border color for table grid lines (e.g. '#CBD5E1')"),
  })
  .passthrough();

export const StageFormSchema = z
  .object({
    targetArtifactId: z
      .string()
      .optional()
      .describe(
        "Optional ID or index (e.g. 'art_1' or '1') of an existing form to update in-place instead of creating a new duplicate",
      ),
    title: z
      .string()
      .describe(
        "Form title, e.g. 'MSME Business Loan Application Form' or 'GOVT ITI Registration Form'",
      ),
    documentBadge: z
      .string()
      .optional()
      .describe(
        "Official document code/badge (e.g. 'FORM NO. 1 • PMEGP', 'UP ITI REGISTRATION')",
      ),
    description: z
      .string()
      .optional()
      .describe("Subtitle, summary or instructions for the form"),
    submitLabel: z
      .string()
      .optional()
      .default("Approve & Submit")
      .describe("Label on the primary action button"),
    formType: z
      .string()
      .optional()
      .describe(
        "Form category or domain, e.g. 'loan_application', 'subsidy_registration', 'vendor_kyc', 'custom'",
      ),
    theme: StageFormThemeSchema.optional().describe(
      "Optional AI-driven styling theme",
    ),
    sections: z
      .array(StageFormSectionSchema)
      .min(1)
      .describe("Array of form sections containing dynamic interactive fields"),
  })
  .passthrough();

export const StageDocumentThemeSchema = z
  .object({
    pageBg: z
      .string()
      .optional()
      .describe("Background color (e.g. '#FFFFFF', '#FAF8F5')"),
    primaryColor: z
      .string()
      .optional()
      .describe(
        "Primary highlight/accent color (e.g. '#1E3A8A', '#15803D', '#C2410C')",
      ),
    textColor: z.string().optional().describe("Text color (e.g. '#0F172A')"),
    borderColor: z
      .string()
      .optional()
      .describe("Border tint for tables/boxes (e.g. '#E2E8F0')"),
  })
  .passthrough();

export const StageDocumentSchema = z
  .object({
    targetArtifactId: z
      .string()
      .optional()
      .describe("Optional ID of an existing document to update in place"),
    title: z
      .string()
      .describe(
        "Title of the document (e.g. 'Wholesale Fertilizer Price Catalog', 'Mudra vs PMEGP Comparison Matrix', 'Official Trade Agreement')",
      ),
    docType: z
      .string()
      .default("catalog")
      .describe("Document category (catalog, table, report, guide, agreement, invoice, other)"),
    summary: z
      .string()
      .optional()
      .describe("Brief 1-sentence summary of the document"),
    theme: StageDocumentThemeSchema.optional().describe(
      "AI-driven visual styling theme matching domain",
    ),
    content: z
      .string()
      .describe(
        "Full markdown text containing GitHub-Flavored Markdown tables, headings, bold prices, badges, and terms",
      ),
  })
  .passthrough();

const GetArtifactsSchema = z
  .object({
    artifactType: z
      .string()
      .optional()
      .default("all")
      .describe(
        "Filter by artifact type ('form', 'document', or 'all')",
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Max number of recent artifacts to retrieve (defaults to 10)"),
  })
  .passthrough();

const GetRecentFilesSchema = z
  .object({
    fileId: z
      .string()
      .optional()
      .describe(
        "Optional fileId or filename of the uploaded file to read/inspect (pass 'latest' to inspect the most recently uploaded file). If omitted, returns the latest 5 uploaded files in this conversation.",
      ),
    query: z
      .string()
      .optional()
      .describe(
        "Optional specific question or extraction goal for this file (e.g. 'Extract total marks', 'Check GST breakdown', 'Summarize key points'). If omitted, extracts the complete content.",
      ),
  })
  .passthrough();

const UpdateBusinessProfileSchema = z
  .object({
    businessName: z
      .string()
      .optional()
      .describe("Name of the user's business, shop, or farm"),
    category: z
      .string()
      .optional()
      .describe(
        "Business sector or trade category (e.g. Bakery, APMC Mandi Wholesale Trader, Grocery, Handloom, Dairy)",
      ),
    city: z
      .string()
      .optional()
      .describe("City or town (e.g. Bangalore, Nashik, Pune, Jaipur, Indore)"),
    district: z
      .string()
      .optional()
      .describe(
        "Hyper-local district or catchment area (e.g. Indiranagar, Bangalore; Lasalgaon, Nashik)",
      ),
    state: z.string().optional().describe("State or Union Territory"),
    pincode: z.string().optional().describe("6-digit postal pincode"),
    monthlyTurnover: z
      .string()
      .optional()
      .describe(
        "Estimated monthly revenue or turnover (e.g. ₹4,50,000 or ₹15 Lakhs)",
      ),
    applicantCategory: z
      .string()
      .optional()
      .describe("Demographic group: Women, SC/ST, General, OBC, Minority"),
    areaType: z
      .enum(["Rural", "Urban", "Semi-Urban"])
      .optional()
      .describe("Rural vs Urban business location"),
    businessStage: z
      .enum(["New", "Existing", "Expansion"])
      .optional()
      .describe("Business operating status: new setup vs existing vs expansion"),
    hasGst: z.boolean().optional().describe("GST registration status"),
    udyamNumber: z.string().optional().describe("Udyam MSME registration number"),
  })
  .passthrough();

function makeEmitter(
  ctx: ToolContext | undefined,
  toolName: string,
  toolCallId: string,
  args?: any,
) {
  let last = 0;
  let pending: string | null = null;
  const send = (content: string) =>
    ctx?.onToolDelta?.({ toolCallId, toolName, content, replace: true, args });
  return {
    emit(content: string) {
      const now = Date.now();
      if (now - last >= 60) {
        last = now;
        pending = null;
        send(content);
      } else {
        pending = content;
      }
    },
    flush() {
      if (pending) {
        send(pending);
        pending = null;
      }
    },
  };
}

function getStagedArtifactsByType(
  conversationId: string | undefined,
  targetType: string,
): any[] {
  if (!conversationId) return [];
  const messages = chatStore.getMessages(conversationId);
  const items: any[] = [];
  const seenIds = new Set<string>();

  for (let mIdx = messages.length - 1; mIdx >= 0; mIdx--) {
    const msg = messages[mIdx];
    let toolCallsList = msg.toolCalls;
    if (typeof toolCallsList === "string") {
      try {
        toolCallsList = JSON.parse(toolCallsList);
      } catch {
        toolCallsList = undefined;
      }
    }
    if (!toolCallsList || !Array.isArray(toolCallsList)) continue;

    for (let i = toolCallsList.length - 1; i >= 0; i--) {
      let tc: any = toolCallsList[i];
      if (typeof tc === "string") {
        try {
          tc = JSON.parse(tc);
        } catch {
          continue;
        }
      }
      if (!tc) continue;
      const toolName = tc.toolName || tc.name;
      const res =
        (typeof tc.result === "string"
          ? (() => {
              try {
                return JSON.parse(tc.result);
              } catch {
                return null;
              }
            })()
          : tc.result) || {};

      const docType = (res.data?.docType || tc.args?.docType || "").toLowerCase();
      const title = (res.title || res.data?.title || tc.args?.title || "").toLowerCase();

      // Check stageDocument records by docType or title keywords, with backward-compatibility for past turns
      const matchesType =
        (toolName === "stageDocument" &&
          (docType.includes(targetType) ||
            title.includes(targetType) ||
            (targetType === "budget" && (docType.includes("budget") || title.includes("budget"))) ||
            (targetType === "expense" && (docType.includes("expense") || title.includes("expense"))) ||
            (targetType === "transaction" && (docType.includes("transaction") || docType.includes("ledger") || title.includes("transaction"))) ||
            (targetType === "saving_goal" && (docType.includes("saving") || title.includes("saving"))) ||
            (targetType === "debt" && (docType.includes("debt") || docType.includes("loan") || title.includes("debt") || title.includes("loan"))))) ||
        res.artifactType === targetType ||
        (targetType === "saving_goal" && res.artifactType === "savinggoal");

      if (matchesType) {
        const payload = res.data || res.artifact || tc.args;
        const id =
          payload?.id ||
          payload?.artifactId ||
          res.artifactId ||
          tc.args?.targetArtifactId ||
          `rec_${items.length + 1}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          items.push({
            id,
            title: res.title || tc.args?.title || "Document Record",
            docType: docType || targetType,
            summary: res.summary || tc.args?.summary,
            content: res.data?.content || tc.args?.content,
            ...payload,
          });
        }
      }
    }
  }
  return items;
}

export function getAgentTools(ctx?: ToolContext) {
  const userId = ctx?.userId;
  const conversationId = ctx?.conversationId;

  return {
    // ─────────────────────────────────────────────────────────────
    // 0.1 BUSINESS PERSONA & HYPER-LOCAL LOCATION MEMORY
    // ─────────────────────────────────────────────────────────────
    updateBusinessContext: tool({
      description:
        "Update the active business persona, trade sector, and hyper-local location context (persisted in client IndexedDB memory) whenever the user mentions what business they run, want to open, or where they are located. Ground future SWOT, competitor scans, and APMC rates to this.",
      inputSchema: UpdateBusinessProfileSchema,
      execute: async (args) => {
        return {
          success: true,
          message: `Saved active business context: ${args.businessName || "Enterprise"} (${args.category || "Trade"}) in ${args.district || args.city || args.state || "Target Area"}. Grounding all scans to this catchment.`,
          profile: {
            ...args,
            source: "auto_extracted",
          },
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 0.5 ATTACHMENT / RECENT FILES RETRIEVAL & INSPECTION
    // ─────────────────────────────────────────────────────────────
    getRecentFiles: tool({
      description:
        "Accesses previous files and attachments uploaded by the user in earlier conversation turns. Call without parameters to see the list of available files (returns the latest 5 files). Call with 'fileId' (or 'latest') to read or analyze a specific document/image.",
      inputSchema: GetRecentFilesSchema,
      execute: async ({ fileId, query }) => {
        if (!conversationId) {
          return {
            success: false,
            message: "No active conversation context.",
            files: [],
          };
        }

        try {
          const messages = chatStore.getMessages(conversationId);

          const allFiles: Array<{
            id: string;
            uploadedName: string;
            savedName?: string;
            url: string;
            type: string;
            mimeType: string;
            size?: number;
            messageId: string;
          }> = [];

          for (const msg of messages) {
            if (Array.isArray(msg.files)) {
              for (let idx = 0; idx < msg.files.length; idx++) {
                const raw = msg.files[idx];
                if (typeof raw === "string") {
                  try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object" && parsed.url) {
                      allFiles.push({
                        id: parsed.id || `att_${msg.id}_${idx}`,
                        uploadedName:
                          parsed.uploadedName || parsed.name || "Attached File",
                        savedName: parsed.savedName,
                        url: parsed.url,
                        type:
                          parsed.type ||
                          (parsed.mimeType?.startsWith("image/")
                            ? "image"
                            : "file"),
                        mimeType: parsed.mimeType || "application/octet-stream",
                        size: parsed.size,
                        messageId: msg.id,
                      });
                      continue;
                    }
                  } catch {
                    // plain url string
                  }
                  allFiles.push({
                    id: `att_${msg.id}_${idx}`,
                    uploadedName: raw.split("/").pop() || "Uploaded File",
                    url: raw,
                    type: "file",
                    mimeType: "application/octet-stream",
                    messageId: msg.id,
                  });
                }
              }
            }
          }

          if (allFiles.length === 0) {
            return {
              success: true,
              totalCount: 0,
              message:
                "No files or documents have been uploaded in this session yet.",
              files: [],
            };
          }

          const latest5Files = allFiles.slice(-5).reverse();

          if (!fileId) {
            return {
              success: true,
              totalCount: allFiles.length,
              files: latest5Files.map((f) => ({
                fileId: f.id,
                uploadedName: f.uploadedName,
                url: f.url,
                type: f.type,
              })),
              hint: "Call getRecentFiles with 'fileId' to read and analyze any of these files.",
            };
          }

          const target =
            fileId.toLowerCase() === "latest"
              ? allFiles[allFiles.length - 1]
              : allFiles.find(
                  (f) =>
                    f.id === fileId ||
                    f.uploadedName.toLowerCase() === fileId.toLowerCase(),
                );

          if (!target) {
            return {
              success: false,
              message: `File "${fileId}" not found among recent conversation attachments.`,
              availableFiles: latest5Files.map((f) => ({
                fileId: f.id,
                uploadedName: f.uploadedName,
              })),
            };
          }

          return {
            success: true,
            file: {
              fileId: target.id,
              uploadedName: target.uploadedName,
              type: target.type,
              mimeType: target.mimeType,
              url: target.url,
            },
            summary: `Found uploaded document "${target.uploadedName}".`,
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Error retrieving attachments: ${err?.message}`,
          };
        }
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 0. ARTIFACT RETRIEVAL & INSPECTION (For In-Place Editing)
    // ─────────────────────────────────────────────────────────────
    getArtifacts: tool({
      description:
        "Retrieves previously staged artifacts (forms, charts, budgets, expenses, transactions, savings goals, debts) from the current conversation in stack order (latest to oldest, with simple index #1, #2...). Use this tool before editing or updating any existing form or chart on user demand.",
      inputSchema: GetArtifactsSchema,
      execute: async ({ artifactType = "all", limit = 10 }) => {
        if (!conversationId) {
          return {
            success: true,
            totalCount: 0,
            artifacts: [],
            message: "No active conversation context.",
          };
        }

        try {
          const messages = chatStore.getMessages(conversationId);

          const extractedArtifacts: Array<{
            artifactId: string;
            index: number;
            messageId: string;
            artifactType: string;
            title: string;
            summary?: string;
            createdAt: string;
            data: any;
          }> = [];

          let globalIndex = 1;
          const seenArtifactIds = new Set<string>();

          for (let mIdx = messages.length - 1; mIdx >= 0; mIdx--) {
            const msg = messages[mIdx];
            let toolCallsList = msg.toolCalls;
            if (typeof toolCallsList === "string") {
              try {
                toolCallsList = JSON.parse(toolCallsList);
              } catch {
                toolCallsList = undefined;
              }
            }
            if (!toolCallsList || !Array.isArray(toolCallsList)) continue;

            for (let i = toolCallsList.length - 1; i >= 0; i--) {
              let tc: any = toolCallsList[i];
              if (typeof tc === "string") {
                try {
                  tc = JSON.parse(tc);
                } catch {
                  continue;
                }
              }
              if (!tc) continue;

              let res = tc.result as any;
              if (typeof res === "string") {
                try {
                  res = JSON.parse(res);
                } catch {
                  // Keep as string
                }
              }

              const toolName = tc.toolName || tc.name;
              const isStagingTool =
                toolName === "stageForm" ||
                toolName === "stageDocument";

              const art =
                res?.artifact ||
                res?.data ||
                (res?.isArtifact ? res : null) ||
                (isStagingTool ? tc.args : null);

              const rawType =
                res?.artifactType ||
                art?.artifactType ||
                res?.type ||
                art?.type ||
                (toolName === "stageForm"
                  ? "form"
                  : toolName === "stageDocument"
                    ? "document"
                    : undefined);

              if (art && rawType) {
                const normalizedType =
                  rawType === "savinggoal" ? "saving_goal" : rawType;

                if (artifactType !== "all" && normalizedType !== artifactType) {
                  continue;
                }

                const artId =
                  art.artifactId ||
                  res?.artifactId ||
                  tc.args?.targetArtifactId ||
                  `art_${globalIndex}`;

                if (seenArtifactIds.has(artId)) continue;
                seenArtifactIds.add(artId);

                extractedArtifacts.push({
                  artifactId: artId,
                  index: globalIndex,
                  messageId: msg.id,
                  artifactType: normalizedType,
                  title:
                    res?.title ||
                    art?.title ||
                    tc.args?.title ||
                    `${normalizedType.toUpperCase()} Draft`,
                  summary: res?.summary || art?.summary || tc.args?.description,
                  createdAt: msg.createdAt,
                  data: art?.sections || art?.data || tc.args?.sections || art,
                });

                globalIndex++;
                if (extractedArtifacts.length >= limit) break;
              }
            }
            if (extractedArtifacts.length >= limit) break;
          }

          return {
            success: true,
            totalCount: extractedArtifacts.length,
            artifacts: extractedArtifacts,
            hint: "To edit any artifact, call the corresponding staging tool (e.g. stageForm) passing targetArtifactId: '<artifactId>' to update it in place.",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error?.message || "Failed to retrieve artifacts.",
          };
        }
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 1. LIVE APMC MANDI RATES (Official data.gov.in + Web Fallback)
    // ─────────────────────────────────────────────────────────────
    getMandiRates: tool({
      description:
        "FAST DIRECT TOOL ONLY: Quickly fetches live APMC wholesale market prices from data.gov.in / Agmarknet for fast, simple conversational answers without opening multi-agent dossier tabs. STRICT MUTUAL EXCLUSIVITY: If you are calling the full sub-agent 'getMandiArbitrage', DO NOT call this tool (and vice versa). Never call both!",
      inputSchema: MandiRatesSchema,
      execute: async ({
        commodity: rawCommodity,
        state: rawState,
        district: rawDistrict,
        market: rawMarket,
      }) => {
        try {
          const normLocation = normalizeDistrictAndState(
            rawDistrict,
            rawState,
            rawMarket,
          );
          const normalizedState = normLocation.state;
          const normalizedDistrict = normLocation.district;
          const normalizedMarket = normLocation.market;
          const normalizedCommodity = rawCommodity
            ? normalizeCommodity(rawCommodity)
            : normLocation.primaryCrops?.[0] || "Wheat";

          const apiKey =
            process.env.DATA_GOV_IN_API_KEY ||
            "579b464db66ec23bdd000001ddb36e098975438e5697e63e567a663c";
          const resourceId = "9ef84268-d588-465a-a308-a864a43d0070";

          let url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=10`;

          if (normalizedCommodity) {
            url += `&filters%5Bcommodity%5D=${encodeURIComponent(normalizedCommodity)}`;
          }
          if (normalizedState) {
            url += `&filters%5Bstate%5D=${encodeURIComponent(normalizedState)}`;
          }
          if (normalizedDistrict) {
            url += `&filters%5Bdistrict%5D=${encodeURIComponent(normalizedDistrict)}`;
          }
          if (normalizedMarket) {
            url += `&filters%5Bmarket%5D=${encodeURIComponent(normalizedMarket)}`;
          }

          let records: any[] = [];
          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
              const data = await response.json();
              records = data?.records || [];
            }
          } catch {
            // fallback to searchLiveMandiWebRates below
          }

          if (records.length > 0) {
            const formattedRecords = records.map((r: any) => ({
              state: r.state || normalizedState || "India",
              district: r.district || normalizedDistrict || "District Yard",
              market: r.market || normalizedMarket || "APMC Mandi",
              commodity: r.commodity || normalizedCommodity,
              variety: r.variety || "Standard",
              arrivalDate:
                r.arrival_date || new Date().toLocaleDateString("en-IN"),
              modalPricePerQuintal: `₹${r.modal_price}`,
              priceRange: `₹${r.min_price} - ₹${r.max_price} / Quintal`,
            }));

            return {
              success: true,
              source: "Official Agmarknet / data.gov.in",
              totalMarkets: formattedRecords.length,
              records: formattedRecords,
            };
          }

          return await searchLiveMandiWebRates({
            commodity: rawCommodity
              ? normalizeCommodity(rawCommodity)
              : "Wheat",
            district: rawDistrict,
            state: rawState,
            market: rawMarket,
          });
        } catch {
          return await searchLiveMandiWebRates({
            commodity: rawCommodity
              ? normalizeCommodity(rawCommodity)
              : "Wheat",
            district: rawDistrict,
            state: rawState,
            market: rawMarket,
          });
        }
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 2. INTELLIGENT WEB GROUNDING (100% SerpApi Google Search)
    // ─────────────────────────────────────────────────────────────
    webSearch: tool({
      description:
        "Searches live Google Web and Places via SerpApi. USE THIS for: quick factual lookups, single shop or business inquiries (e.g., 'Where is Photo Point?', 'Address/phone of ABC Studio', 'Owner of XYZ Traders'), local prices, trade news, and official bank loan guidelines. DO NOT awaken heavy multi-agent swarms or generate map radars for single-shop questions; use webSearch for fast, direct conversational answers without cards or tables.",
      inputSchema: WebSearchSchema,
      execute: async ({ query, numResults = 5 }) => {
        try {
          const serpResults = await searchGoogleWeb(query, numResults);
          if (serpResults && serpResults.length > 0) {
            return {
              success: true,
              provider: "SerpApi Google Search",
              query,
              results: serpResults,
            };
          }

          return {
            success: true,
            provider: "SerpApi Google Search",
            query,
            count: 0,
            results: [],
            message: `No live search results found for "${query}".`,
          };
        } catch (err: any) {
          return {
            success: false,
            error: "Web search service is momentarily unreachable.",
          };
        }
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 3. HYPER-LOCAL COMPETITOR INTELLIGENCE (SerpApi Google Maps)
    // ─────────────────────────────────────────────────────────────
    searchCompetitors: tool({
      description:
        "Discovers, deduplicates, and analyzes real nearby competitor shops, rival outlets, or businesses for any commercial category using live web grounding, hyper-local landmarks, and Udyam MSME saturation data.",
      inputSchema: SearchCompetitorsSchema,
      execute: async ({
        query,
        category,
        radiusKm = 5,
        location,
        lat,
        lon,
        bypassCache,
      }) => {
        const resolvedCategory = category || query || "Retail Outlet";
        const result = await searchCompetitorsIntelligence({
          category: resolvedCategory,
          radiusKm,
          location,
          lat,
          lon,
          userId,
          bypassCache,
        });

        const shops =
          result.allPlaces && result.allPlaces.length > 0
            ? result.allPlaces
            : result.competitors || [];
        const avgRating =
          shops.length > 0
            ? (
                shops.reduce((a, b) => a + (b.rating || 4.0), 0) / shops.length
              ).toFixed(1)
            : "4.0";
        const highThreats = shops.filter(
          (s) => s.threatLevel === "High",
        ).length;

        // Rank competitors: highest rating, then highest review count
        const sortedShops = [...shops].sort(
          (a, b) =>
            (b.rating || 0) - (a.rating || 0) ||
            (b.reviews || 0) - (a.reviews || 0),
        );
        const top5 = sortedShops.slice(0, 5);
        const top5Spoken = top5
          .map(
            (s, idx) =>
              `${idx + 1}. ${s.name}${s.rating ? ` (${s.rating}★)` : ""}${s.landmark && s.landmark !== "Local Area" && s.landmark !== "Catchment Area" ? ` near ${s.landmark}` : ""}`,
          )
          .join(", ");

        const spokenSummary =
          top5.length > 0
            ? `Located ${shops.length} verified competitors for ${resolvedCategory} in ${result.locationSummary || location || "your catchment area"}. The top ${top5.length} are: ${top5Spoken}. The complete interactive map and radar are now on your screen.`
            : (result.spokenSummary || `Located ${shops.length} verified competitors for ${resolvedCategory}.`);

        // Calculate true geographic centroid of all verified competitor shops from SerpApi
        const validCoords = shops.filter(
          (s) =>
            typeof s.lat === "number" &&
            !isNaN(s.lat) &&
            typeof s.lng === "number" &&
            !isNaN(s.lng),
        );
        const centroidLat =
          validCoords.length > 0
            ? validCoords.reduce((sum, s) => sum + (s.lat ?? 0), 0) / validCoords.length
            : undefined;
        const centroidLng =
          validCoords.length > 0
            ? validCoords.reduce((sum, s) => sum + (s.lng ?? 0), 0) / validCoords.length
            : undefined;

        // Helper to check distance between user's profile lat/lon and shop centroid
        const calcDistKm = (
          lat1: number,
          lon1: number,
          lat2: number,
          lon2: number,
        ) => {
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        let centerLat = centroidLat ?? lat ?? 12.9716;
        let centerLng = centroidLng ?? lon ?? 77.5946;
        let isHubNearby = false;

        if (lat && lon) {
          if (centroidLat !== undefined && centroidLng !== undefined) {
            const dist = calcDistKm(lat, lon, centroidLat, centroidLng);
            if (dist <= radiusKm * 1.5) {
              centerLat = lat;
              centerLng = lon;
              isHubNearby = true;
            } else {
              centerLat = centroidLat;
              centerLng = centroidLng;
              isHubNearby = false;
            }
          } else {
            centerLat = lat;
            centerLng = lon;
            isHubNearby = true;
          }
        }

        const content = `### 📍 Competitor Intelligence: ${resolvedCategory} (${result.locationSummary || location || "Catchment Zone"})

Real-time commercial landscape scanned via Google Maps Places API across a ${radiusKm}km operating radius (${shops.length} total outlets verified).

\`\`\`cards
${JSON.stringify(
  {
    title: "Catchment Saturation Overview",
    cards: [
      {
        label: "Competitors Mapped",
        value: `${shops.length} Outlets`,
        status: "neutral",
        subtext: `Within ${radiusKm}km`,
      },
      {
        label: "Avg Customer Rating",
        value: `${avgRating}★`,
        status: Number(avgRating) >= 4.2 ? "warning" : "positive",
        subtext: "Catchment satisfaction",
      },
      {
        label: "High-Threat Rivals",
        value: `${highThreats}`,
        status: highThreats > 2 ? "negative" : "positive",
        subtext: "4.3+★ & >40 reviews",
      },
    ],
  },
  null,
  2,
)}
\`\`\`

\`\`\`map
${JSON.stringify(
  {
    title: `${resolvedCategory} Catchment Map (${result.locationSummary || location || "Local Catchment"})`,
    center: [centerLat, centerLng],
    zoom: radiusKm <= 2 ? 15 : radiusKm <= 5 ? 14 : 13,
    radiusKm: radiusKm,
    markers: [
      ...(lat && lon && isHubNearby
        ? [
            {
              lat: lat,
              lng: lon,
              title: result.targetBusinessName || "Proposed Business Location",
              type: "hub" as const,
              address: result.locationSummary || location || "Target Hub",
            },
          ]
        : []),
      ...shops.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        title: s.name,
        rating: s.rating,
        reviews: s.reviews,
        threatLevel: s.threatLevel as "High" | "Medium" | "Low",
        distance: s.distance,
        address: s.landmark,
        type: "competitor" as const,
      })),
    ],
    summary: `Interactive radar showing ${shops.length} verified commercial outlets on OpenStreetMap with real customer review volumes.`,
  },
  null,
  2,
)}
\`\`\`

| Business Name | Distance | Rating & Reviews | Price Tier | Address / Area | Threat Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
${shops.map((s) => `| **${s.name}** | ${s.distance} | ★ ${s.rating || "4.0"} (${s.reviews || 0}) | ${s.priceRange || "$$"} | ${s.landmark || "Local Area"} | ${s.threatLevel === "High" ? "🔴 High" : s.threatLevel === "Medium" ? "🟡 Medium" : "🟢 Low"} |`).join("\n")}

> **Market Positioning Recommendation:**
> Focus on personalized customer khata, WhatsApp delivery, and targeted micro-catchments where competitor ratings dip below 4.0★ to secure recurring footfall.`;

        return {
          ...result,
          content,
          spokenSummary,
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 4. ONDC DIGITAL COMMERCE INTELLIGENCE
    // ─────────────────────────────────────────────────────────────
    getOndcIntelligence: tool({
      description:
        "Discovers ONDC (Open Network for Digital Commerce) opportunities including B2B wholesale procurement at 8-12% discounts, B2C digital seller apps (Mystore, Magicpin) at 3% commission, and hyper-local delivery partners for any enterprise.",
      inputSchema: OndcIntelligenceSchema,
      execute: async ({ category, location, intent, bypassCache }) => {
        const result = await getOndcIntelligence({
          category,
          location,
          intent,
          userId,
          bypassCache,
        });

        const procurement = result.data?.procurement || [];
        const platforms = result.data?.sellerPlatforms || [];
        const comparison = result.data?.commissionComparison;

        const content = `### 🌐 ONDC Digital Commerce Roadmap: ${result.category || category || "Enterprise"} (${result.location || location || "India"})

Open Network for Digital Commerce (ONDC) blueprint providing direct manufacturer procurement discounts and 3%-5% seller network onboarding.

\`\`\`cards
${JSON.stringify(
  {
    title: "ONDC Digital Commerce Economics",
    cards: [
      {
        label: "Traditional Aggregators",
        value: comparison?.traditionalAggregatorRate || "25% - 30%",
        status: "negative",
        subtext: "Legacy aggregator cut",
      },
      {
        label: "ONDC Platform Fee",
        value: comparison?.ondcCommissionRate || "3% - 5%",
        status: "positive",
        subtext: "Mystore / Magicpin / SellerApp",
      },
      {
        label: "Monthly Margin Boost",
        value: comparison?.monthlyMarginBoostPercent || "+20%",
        status: "positive",
        subtext: "Direct retained margin",
      },
    ],
  },
  null,
  2,
)}
\`\`\`

\`\`\`mermaid
graph LR
    A[Wholesale Mandi / Supplier] -->|Direct ONDC B2B 8-12% Discount| B[My Enterprise]
    B -->|Seller Network 3-5% Fee| C[Mystore / Magicpin]
    C -->|Open Buyer Network| D[PhonePe Pincode / Paytm]
    D -->|Hyper-local Logistics| E[End Consumer]
\`\`\`

#### 📦 Direct B2B Wholesale Procurement
| Commodity / Raw Material | Traditional Wholesale Cut | ONDC Direct Rate Discount | Monthly Est. Savings |
| :--- | :--- | :--- | :--- |
${procurement.map((p) => `| **${p.commodity}** | ${p.traditionalMarginPercent} | **${p.ondcWholesaleDiscountPercent}** | **₹${p.estimatedMonthlySavingsInr.toLocaleString("en-IN")}/mo** |`).join("\n")}

#### 🛒 Recommended Digital Seller Networks
| Seller Application | Commission Fee | Reach & Channels | Best Suited For |
| :--- | :--- | :--- | :--- |
${platforms.map((pl) => `| **${pl.platformName}** | **${pl.commissionRate}** | ${(pl.buyerNetworkReach || []).join(", ")} | ${pl.bestFor} |`).join("\n")}

> **Immediate Action Checklist:**
${(result.data?.recommendedActions || []).map((a) => `> • ${a}`).join("\n")}`;

        return {
          ...result,
          content,
          spokenSummary:
            result.spokenSummary ||
            `ONDC connects you to wholesale procurement at 8 to 12 percent discounts and digital selling at only 3 to 5 percent platform commission.`,
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 5. DISTRICT HIGH-ROI BUSINESS OPPORTUNITY PREDICTOR
    // ─────────────────────────────────────────────────────────────
    predictDistrictBusinesses: tool({
      description:
        "Researches and predicts the Top 4 high-ROI, low-saturation business opportunities in any Indian district for a given budget using autonomous live web search, APMC Mandi trends, and Udyam MSME subsidies (PMEGP 35%, PMFME, Mudra).",
      inputSchema: PredictDistrictBusinessesSchema,
      execute: async ({
        district,
        state,
        budget,
        category,
        riskLevel,
        bypassCache,
        spaceAvailableSqFt,
        powerConnectivity,
        salesChannel,
        entrepreneurExperience,
        manpowerAvailable,
        preferredSubsidies,
      }) => {
        const result = await predictDistrictBusinessesIntelligence({
          district,
          state,
          budget,
          category,
          riskLevel,
          userId,
          bypassCache,
          spaceAvailableSqFt,
          powerConnectivity,
          salesChannel,
          entrepreneurExperience,
          manpowerAvailable,
          preferredSubsidies,
        });

        const cards = result.cards || [];

        const content = `### 🏙️ High-ROI Business Opportunities: ${result.district}, ${result.state} (Budget: ₹${((result.budget || 200000) / 100000).toFixed(1)} Lakh)

Autonomous market analysis grounded in live district commercial saturation, APMC wholesale supply, and central MSME subsidy programs.

\`\`\`cards
${JSON.stringify(
  {
    title: "District Feasibility Highlights",
    cards: cards.slice(0, 4).map((c) => ({
      label: c.title.slice(0, 20),
      value: c.monthlyProfit?.formatted || "₹35k/mo",
      status:
        c.riskLevel === "LOW"
          ? "positive"
          : c.riskLevel === "MODERATE"
            ? "neutral"
            : "warning",
      subtext: `Payback: ${c.paybackPeriodMonths || 6} Mo`,
    })),
  },
  null,
  2,
)}
\`\`\`

| Venture Category | Investment Req. | Expected Monthly Profit | Margin % | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
${cards.map((c) => `| **${c.title}** | ${c.capitalRequired?.formatted || "—"} | **${c.monthlyProfit?.formatted || "—"}** | ${c.monthlyProfit?.marginPercentage || 20}% | ${c.riskLevel === "LOW" ? "🟢 Low Risk" : c.riskLevel === "MODERATE" ? "🟡 Moderate" : "🔴 High Risk"} |`).join("\n")}

#### 💡 Sector Insights & Subsidies
${cards.map((c) => `**${c.title}**: ${c.whyInThisDistrict}\n- *Subsidy:* ${(c.matchedSubsidies || []).map((s) => `${s.name} (${s.percentage})`).join(", ") || "Eligible for Mudra & PMEGP"}`).join("\n\n")}`;

        return {
          ...result,
          content,
          spokenSummary:
            result.spokenSummary ||
            `In ${result.district}, top recommended ventures for ₹${((result.budget || 200000) / 100000).toFixed(1)} Lakh budget include ${cards[0]?.title || "manufacturing"} and ${cards[1]?.title || "retail"} with up to 35% PMEGP subsidy eligibility.`,
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 6. GOVERNMENT SCHEMES & SUBSIDIES
    // ─────────────────────────────────────────────────────────────
    getGovtSchemes: tool({
      description:
        "FAST DIRECT TOOL ONLY: Quickly queries official government portals and guidelines via Google search for any central or state credit or subsidy scheme (e.g. PM Mudra, PMEGP, PM SVANidhi, Stand-Up India, PMFME, State subsidies). STRICT MUTUAL EXCLUSIVITY: If you are calling the full sub-agent 'evaluateGovtSchemes', DO NOT call this tool (and vice versa). Never call both!",
      inputSchema: SchemeEligibilitySchema,
      execute: async (params) => {
        const {
          schemeName,
          query: specificQuery,
          annualTurnover,
          loanAmountRequested,
          businessSector,
          state,
          district,
          applicantCategory,
          areaType,
          businessStage,
        } = params;

        const queryTerms = [
          schemeName,
          specificQuery,
          businessSector,
          applicantCategory ? `${applicantCategory} category` : null,
          areaType,
          district,
          state,
          businessStage,
          "scheme eligibility subsidy guidelines official portal site:gov.in OR site:nic.in OR site:in",
        ]
          .filter(Boolean)
          .join(" ");

        const searchResults = await searchGoogleWeb(queryTerms, 5);
        return {
          success: true,
          ...params,
          searchQueryUsed: queryTerms,
          officialGuidelines: searchResults,
          source: "Live Official Web Search (SerpApi)",
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 7. FINANCIAL STATE TOOLS (Query Staged Documents)
    // ─────────────────────────────────────────────────────────────
    getBudgets: tool({
      description:
        "Retrieves active enterprise budget allocations and financial plans staged in the current conversation via stageDocument.",
      inputSchema: z.object({}).passthrough(),
      execute: async () => {
        const stagedBudgets = getStagedArtifactsByType(conversationId, "budget");
        return {
          success: true,
          budgets: stagedBudgets,
          count: stagedBudgets.length,
          message:
            stagedBudgets.length === 0
              ? "No budget plans recorded yet in this session. You can create a structured budget allocation table using stageDocument."
              : `Found ${stagedBudgets.length} active budget plan(s).`,
        };
      },
    }),

    getExpenses: tool({
      description:
        "Retrieves logged business expenses and statements staged in the current conversation via stageDocument.",
      inputSchema: z
        .object({
          category: z.string().optional(),
          limit: z.number().optional().default(10),
        })
        .passthrough(),
      execute: async ({ category, limit = 10 }) => {
        const stagedExpenses = getStagedArtifactsByType(conversationId, "expense");
        const filtered = category
          ? stagedExpenses.filter((e) =>
              JSON.stringify(e).toLowerCase().includes(category.toLowerCase()),
            )
          : stagedExpenses;
        return {
          success: true,
          expenses: filtered.slice(0, limit),
          count: filtered.length,
          message:
            filtered.length === 0
              ? "No expenses logged yet in this session. You can compile an expense statement using stageDocument."
              : `Found ${filtered.length} logged expense record(s).`,
        };
      },
    }),

    getTransactions: tool({
      description:
        "Retrieves master ledger transactions and cash flow sheets staged in the current conversation via stageDocument.",
      inputSchema: z
        .object({
          type: z
            .string()
            .optional()
            .describe("Transaction type filter (INCOME, EXPENSE, TRANSFER, DEBT_PAYMENT, SAVING, OTHER)"),
          limit: z.number().optional().default(10),
        })
        .passthrough(),
      execute: async ({ type, limit = 10 }) => {
        const stagedTx = getStagedArtifactsByType(conversationId, "transaction");
        const filtered = type
          ? stagedTx.filter((t) =>
              JSON.stringify(t).toLowerCase().includes(type.toLowerCase()),
            )
          : stagedTx;
        return {
          success: true,
          transactions: filtered.slice(0, limit),
          count: filtered.length,
          message:
            filtered.length === 0
              ? "No transactions recorded yet in this session. You can create a ledger transaction sheet using stageDocument."
              : `Found ${filtered.length} transaction record(s).`,
        };
      },
    }),

    getSavingsGoals: tool({
      description:
        "Retrieves active savings targets and reserve fund plans staged in the current conversation via stageDocument.",
      inputSchema: z.object({}).passthrough(),
      execute: async () => {
        const stagedGoals = getStagedArtifactsByType(
          conversationId,
          "saving_goal",
        );
        return {
          success: true,
          goals: stagedGoals,
          count: stagedGoals.length,
          message:
            stagedGoals.length === 0
              ? "No savings goals established yet in this session. You can create a savings target plan using stageDocument."
              : `Found ${stagedGoals.length} savings goal(s).`,
        };
      },
    }),

    getDebts: tool({
      description:
        "Retrieves active loan liabilities and EMI schedules staged in the current conversation via stageDocument.",
      inputSchema: z.object({}).passthrough(),
      execute: async () => {
        const stagedDebts = getStagedArtifactsByType(conversationId, "debt");
        return {
          success: true,
          debts: stagedDebts,
          count: stagedDebts.length,
          message:
            stagedDebts.length === 0
              ? "No active loan liabilities or debt records found in this session. You can create an EMI & debt schedule using stageDocument."
              : `Found ${stagedDebts.length} active liability record(s).`,
        };
      },
    }),

    getBusinessProfile: tool({
      description:
        "Retrieves registered enterprise profile and trade particulars from the current conversation context.",
      inputSchema: z.object({}).passthrough(),
      execute: async () => {
        let profile: any = null;
        if (conversationId) {
          const messages = chatStore.getMessages(conversationId);
          for (let mIdx = messages.length - 1; mIdx >= 0; mIdx--) {
            const msg = messages[mIdx];
            let toolCallsList = msg.toolCalls;
            if (typeof toolCallsList === "string") {
              try {
                toolCallsList = JSON.parse(toolCallsList);
              } catch {}
            }
            if (Array.isArray(toolCallsList)) {
              for (const tc of toolCallsList) {
                if ((tc.toolName || tc.name) === "updateBusinessContext") {
                  const res =
                    typeof tc.result === "string"
                      ? JSON.parse(tc.result || "{}")
                      : tc.result;
                  profile = res?.profile || tc.args;
                  break;
                }
              }
            }
            if (profile) break;
          }
        }
        if (!profile) {
          return {
            success: true,
            hasProfile: false,
            message:
              "No business profile established yet for this session. Ask the user for their business name, category, or location, and persist it with updateBusinessContext.",
          };
        }
        return {
          success: true,
          hasProfile: true,
          ...profile,
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 8. INTERACTIVE ARTIFACT STAGING TOOLS (Dynamic Forms & Structured Documents)
    // ─────────────────────────────────────────────────────────────

    stageForm: tool({
      description:
        "Generates or updates a dynamic, interactive multi-field form artifact (e.g. Loan Applications, MSME Subsidies, Vendor KYC, Trade Inquiries, Checklists). For bank loans or government schemes not yet researched in this conversation history, call webSearch first to discover authentic fields before staging.",
      inputSchema: StageFormSchema,
      execute: async ({
        targetArtifactId,
        title,
        documentBadge,
        theme,
        description,
        submitLabel,
        formType,
        sections,
      }) => {
        const totalFields = sections.reduce((sum, sec) => {
          let count = (sec.fields || []).length;
          if (sec.rows) {
            for (const r of sec.rows) {
              count += (r.fields || []).length;
            }
          }
          return sum + count;
        }, 0);
        const artId = targetArtifactId || `art_form_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "form",
          title,
          summary:
            description ||
            `${sections.length} sections • ${totalFields} interactive fields`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            title,
            documentBadge: documentBadge || undefined,
            theme: theme || undefined,
            description: description || "",
            submitLabel: submitLabel || "Approve & Submit",
            formType: formType || "general",
            sections,
          },
        };
      },
    }),

    stageDocument: tool({
      description:
        "Generates or updates a rich, structured Markdown document artifact modal (e.g. Price Catalogs, APMC Wholesale Rate Sheets, Scheme Comparison Matrices, Official Agreements, Invoices, Checklists, Policies) with formatted GFM tables, bold figures, and domain colors. Use 'targetArtifactId' to update an open document in place.",
      inputSchema: StageDocumentSchema,
      execute: async ({
        targetArtifactId,
        title,
        docType,
        summary,
        theme,
        content,
      }) => {
        const artId = targetArtifactId || `art_doc_${Date.now()}`;
        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "document",
          title,
          summary: summary || `${title} (${docType || "document"})`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            title,
            docType: docType || "catalog",
            summary: summary || "",
            theme: theme || {},
            content,
          },
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 9. SERPAPI SPECIALIZED RESEARCH SUB-AGENTS
    // ─────────────────────────────────────────────────────────────
    newsSearch: tool({
      description:
        "Searches Google News via SerpApi for breaking commodity prices, regulatory changes, or trade updates.",
      inputSchema: z
        .object({
          query: z.string().describe("News topic or query to search"),
          numResults: z
            .number()
            .optional()
            .default(5)
            .describe("Number of news articles to retrieve"),
        })
        .passthrough(),
      execute: async ({ query, numResults }) => {
        const news = await searchGoogleNews(query, numResults);
        return {
          success: true,
          count: news.length,
          news,
        };
      },
    }),

    evaluateCreditAndEMI: tool({
      description:
        "Calculates monthly EMI, amortization schedule, debt burden, and compares live bank loan interest rates (SBI, HDFC, Mudra) scraped via SerpApi.",
      inputSchema: z
        .object({
          amount: z
            .number()
            .describe("Requested loan principal amount in INR (e.g. 500000)"),
          tenureYears: z
            .number()
            .optional()
            .default(3)
            .describe("Loan tenure in years (e.g. 1 to 7)"),
          interestRate: z
            .number()
            .optional()
            .default(10.5)
            .describe("Annual interest rate percentage (e.g. 10.5)"),
          monthlyRevenue: z
            .number()
            .optional()
            .describe(
              "User's monthly revenue/turnover in INR for burden calculation",
            ),
          existingMonthlyEmi: z
            .number()
            .optional()
            .describe("Current monthly EMI obligations for FOIR debt-burden calculation"),
          purpose: z
            .string()
            .optional()
            .describe(
              "Purpose of loan (e.g. inventory, machinery, working capital, expansion)",
            ),
          creditScoreCategory: z
            .enum(["Excellent_750+", "Good_700-750", "Average_650-700", "New_To_Credit"])
            .optional()
            .describe("Applicant credit score tier"),
          collateralAvailable: z
            .string()
            .optional()
            .describe("Collateral status: CGTMSE zero-collateral, hypothecation, property mortgage"),
          lenderPreference: z
            .string()
            .optional()
            .describe("Preferred lender: Public Sector Bank, Private Bank, Mudra NBFC, MFI"),
          subventionEligible: z
            .boolean()
            .optional()
            .describe("Whether eligible for prompt repayment or AIF interest subsidy"),
        })
        .passthrough(),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_credit`;
        const em = makeEmitter(ctx, "evaluateCreditAndEMI", toolCallId, params);
        const result = await runCreditEMISubAgent(params, {
          onMarkdown: (md) => em.emit(stableMarkdown(md)),
        });
        em.flush();

        return {
          success: true,
          isArtifact: true,
          artifactType: "emi_calculator",
          title: `EMI & Loan Analysis (₹${((params.amount || 500000) / 100000).toFixed(1)} Lakh @ ${params.interestRate || 10.5}%)`,
          summary: result.summary,
          spokenSummary: result.spokenSummary,
          data: {
            ...result,
            content: result.markdown,
            spokenSummary: result.spokenSummary,
          },
        };
      },
    }),

    runSWOTScan: tool({
      description:
        "Pulls local competitor density via SerpApi Google Maps and live market trends to build an authentic 4-quadrant SWOT matrix.",
      inputSchema: z
        .object({
          category: z
            .string()
            .describe(
              "Business sector or category (e.g. 'Biryani Cloud Kitchen', 'Kirana', 'Automobile Workshop')",
            ),
          location: z
            .string()
            .optional()
            .describe(
              "Target neighborhood, area, or city (e.g. 'Koramangala, Bangalore' or 'Indore')",
            ),
          radiusKm: z
            .number()
            .optional()
            .default(5)
            .describe("Catchment radius in kilometers to scan (e.g. 2, 5, 10)"),
          lat: z.number().optional().describe("Latitude coordinate if available"),
          lon: z
            .number()
            .optional()
            .describe("Longitude coordinate if available"),
          userBusinessName: z
            .string()
            .optional()
            .describe("User's own business or shop name to benchmark against rivals"),
          priceTier: z
            .enum(["Budget", "Mid-Range", "Premium"])
            .optional()
            .describe("Target price and quality segment"),
          specificThreatsOrStrengths: z
            .string()
            .optional()
            .describe("Specific known competitive advantages or challenges"),
        })
        .passthrough(),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_swot`;
        const em = makeEmitter(ctx, "runSWOTScan", toolCallId, params);
        const result = await runSWOTSubAgent(params, {
          onMarkdown: (md) => em.emit(stableMarkdown(md)),
        });
        em.flush();

        return {
          success: true,
          isArtifact: true,
          artifactType: "swot_matrix",
          title: `SWOT Matrix: ${params.category} (${result.location})`,
          summary: result.summary,
          spokenSummary: result.spokenSummary,
          data: {
            ...result,
            content: result.markdown,
            spokenSummary: result.spokenSummary,
          },
        };
      },
    }),

    scanCatchmentRadar: tool({
      description:
        "Scans local competitor radar using SerpApi Google Maps with exact distances, user ratings, price tiers, and threat assessments.",
      inputSchema: z
        .object({
          category: z
            .string()
            .describe(
              "Commercial business type to search (e.g. 'Coffee Shop', 'Hardware Store')",
            ),
          location: z
            .string()
            .optional()
            .describe("Neighborhood, street, or city"),
          radiusKm: z
            .number()
            .optional()
            .default(5)
            .describe("Catchment radius in kilometers"),
          lat: z.number().optional().describe("Latitude coordinate"),
          lon: z.number().optional().describe("Longitude coordinate"),
          userBusinessName: z
            .string()
            .optional()
            .describe("User's own business name to benchmark directly against competitors"),
          keywordFilter: z
            .string()
            .optional()
            .describe("Specific keyword or specialty filter for places scan"),
        })
        .passthrough(),
      execute: async (params) => {
        const shops = await searchCatchmentShops(params);
        const avgRating =
          shops.length > 0
            ? (
                shops.reduce((a, b) => a + (b.rating || 4.0), 0) / shops.length
              ).toFixed(1)
            : "4.0";
        const highThreats = shops.filter(
          (s) => s.threatLevel === "High",
        ).length;

        // Rank competitors: highest rating, then highest review count
        const sortedShops = [...shops].sort(
          (a, b) =>
            (b.rating || 0) - (a.rating || 0) ||
            (b.reviews || 0) - (a.reviews || 0),
        );
        const top5 = sortedShops.slice(0, 5);
        const top5Spoken = top5
          .map(
            (s, idx) =>
              `${idx + 1}. ${s.name}${s.rating ? ` (${s.rating}★)` : ""}${s.landmark && s.landmark !== "Local Area" && s.landmark !== "Catchment Area" ? ` near ${s.landmark}` : ""}`,
          )
          .join(", ");

        const summary = `**Catchment Radar**: Located **${shops.length} verified commercial outlets** on Google Maps within **${params.radiusKm || 5}km** in ${params.location || "Catchment Area"}. Average customer rating is **${avgRating}★** with ${highThreats} high-threat competitors detected.`;
        const spokenSummary =
          top5.length > 0
            ? `Located ${shops.length} verified competitors for ${params.category} in ${params.location || "your catchment area"}. The top ${top5.length} are: ${top5Spoken}. The complete interactive map and radar are now on your screen.`
            : `Located ${shops.length} verified competitors for ${params.category} within ${params.radiusKm || 5} kilometers of ${params.location || "your location"}.`;

        // Calculate true geographic centroid of all verified competitor shops from SerpApi
        const validCoords = shops.filter(
          (s) =>
            typeof s.lat === "number" &&
            !isNaN(s.lat) &&
            typeof s.lng === "number" &&
            !isNaN(s.lng),
        );
        const centroidLat =
          validCoords.length > 0
            ? validCoords.reduce((sum, s) => sum + (s.lat ?? 0), 0) / validCoords.length
            : undefined;
        const centroidLng =
          validCoords.length > 0
            ? validCoords.reduce((sum, s) => sum + (s.lng ?? 0), 0) / validCoords.length
            : undefined;

        // Helper to check distance between user's profile lat/lon and shop centroid
        const calcDistKm = (
          lat1: number,
          lon1: number,
          lat2: number,
          lon2: number,
        ) => {
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Determine true center: if params.lat/lon is close to cluster (<= radius * 1.5), keep it.
        // Otherwise, center the radar circle and map directly on the shops' centroid!
        let centerLat = centroidLat ?? params.lat ?? 12.9716;
        let centerLng = centroidLng ?? params.lon ?? 77.5946;
        let isHubNearby = false;

        if (params.lat && params.lon) {
          if (centroidLat !== undefined && centroidLng !== undefined) {
            const dist = calcDistKm(
              params.lat,
              params.lon,
              centroidLat,
              centroidLng,
            );
            if (dist <= (params.radiusKm || 5) * 1.5) {
              centerLat = params.lat;
              centerLng = params.lon;
              isHubNearby = true;
            } else {
              // User searched an area separate from their profile; center radar on the shops
              centerLat = centroidLat;
              centerLng = centroidLng;
              isHubNearby = false;
            }
          } else {
            centerLat = params.lat;
            centerLng = params.lon;
            isHubNearby = true;
          }
        }

        const content = `### 📍 Catchment Competitor Radar: ${params.category} (${params.location || "Catchment Zone"})

Real-time commercial landscape scanned via Google Maps Places API across a ${params.radiusKm || 5}km operating radius (${shops.length} total outlets verified).

\`\`\`cards
${JSON.stringify(
  {
    title: "Catchment Saturation Overview",
    cards: [
      {
        label: "Competitors Mapped",
        value: `${shops.length} Outlets`,
        status: "neutral",
        subtext: `Within ${params.radiusKm || 5}km`,
      },
      {
        label: "Avg Customer Rating",
        value: `${avgRating}★`,
        status: Number(avgRating) >= 4.2 ? "warning" : "positive",
        subtext: "Catchment satisfaction",
      },
      {
        label: "High-Threat Rivals",
        value: `${highThreats}`,
        status: highThreats > 2 ? "negative" : "positive",
        subtext: "4.3+★ & >40 reviews",
      },
    ],
  },
  null,
  2,
)}
\`\`\`

\`\`\`map
${JSON.stringify(
  {
    title: `${params.category} Catchment Map (${params.location || "Local Catchment"})`,
    center: [centerLat, centerLng],
    zoom:
      (params.radiusKm || 5) <= 2 ? 15 : (params.radiusKm || 5) <= 5 ? 14 : 13,
    radiusKm: params.radiusKm || 5,
    markers: [
      ...(params.lat && params.lon && isHubNearby
        ? [
            {
              lat: params.lat,
              lng: params.lon,
              title: "Proposed Business Location",
              type: "hub" as const,
              address: params.location || "Target Hub",
            },
          ]
        : []),
      ...shops.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        title: s.name,
        rating: s.rating,
        reviews: s.reviews,
        threatLevel: s.threatLevel as "High" | "Medium" | "Low",
        distance: s.distance,
        address: s.landmark || s.address,
        type: "competitor" as const,
      })),
    ],
    summary: `Interactive radar showing ${shops.length} verified commercial outlets on OpenStreetMap with real customer review volumes.`,
  },
  null,
  2,
)}
\`\`\`

| Business Name | Distance | Rating & Reviews | Price Tier | Address / Area | Threat Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
${shops.map((s) => `| **${s.name}** | ${s.distance} | ★ ${s.rating || "4.0"} (${s.reviews || 0}) | ${s.priceRange || "$$"} | ${s.landmark || "Local Area"} | ${s.threatLevel === "High" ? "🔴 High" : s.threatLevel === "Medium" ? "🟡 Medium" : "🟢 Low"} |`).join("\n")}

> **Market Positioning Recommendation:**
> Focus on personalized customer khata, WhatsApp delivery, and targeted micro-catchments where competitor ratings dip below 4.0★ to secure recurring footfall.`;

        return {
          success: true,
          isArtifact: true,
          artifactType: "catchment_radar",
          title: `Competitor Radar: ${params.category} (${shops.length} Outlets)`,
          summary,
          spokenSummary,
          data: {
            category: params.category,
            location: params.location || "Catchment Area",
            radiusKm: params.radiusKm || 5,
            totalFound: shops.length,
            competitors: shops,
            content,
            spokenSummary,
          },
        };
      },
    }),

    getMandiArbitrage: tool({
      description:
        "FULL SUB-AGENT TOOL: Deeply evaluates live APMC yard prices, calculates inter-mandi price spreads, transport viability, Recharts graphs, and dedicated Swarm dossier tabs. For multiple commodities (e.g. Onion and Wheat), call this tool once for each commodity in parallel. STRICT MUTUAL EXCLUSIVITY: If you call 'getMandiArbitrage', DO NOT call the direct tool 'getMandiRates' (and vice versa). Never call both!",
      inputSchema: z
        .object({
          commodity: z
            .string()
            .optional()
            .describe(
              "Crop or commodity name (e.g. 'Mustard', 'Wheat', 'Onion', 'Soybean', 'Tomato', 'Paddy')",
            ),
          district: z.string().optional().describe("Source district or base mandi yard name"),
          state: z.string().optional().describe("State name"),
          variety: z.string().optional().describe("Specific variety (e.g. 'Lokwan', 'Hybrid', 'Red', 'Desi')"),
          targetMarkets: z
            .array(z.string())
            .optional()
            .describe("Target consumption mandis to compare against (e.g. ['Azadpur', 'Vashi', 'Bengaluru APMC'])"),
          quantityQuintals: z
            .number()
            .optional()
            .describe("Estimated trade lot size in quintals (for net arbitrage calculation)"),
          transportCostPerQuintal: z
            .number()
            .optional()
            .describe("Estimated freight and loading cost per quintal in INR"),
          query: z
            .string()
            .optional()
            .describe("Specific arbitrage question or market spread inquiry"),
        })
        .passthrough(),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_mandi`;
        const em = makeEmitter(ctx, "getMandiArbitrage", toolCallId, params);
        const result = await runMandiSubAgent(params, {
          onMarkdown: (md) => em.emit(stableMarkdown(md)),
        });
        em.flush();

        return {
          success: true,
          isArtifact: true,
          artifactType: "mandi_arbitrage",
          title: `Mandi Price Spread: ${result.commodity} (${result.baseDistrict})`,
          summary: result.summary,
          spokenSummary: result.spokenSummary,
          data: {
            ...result,
            content: result.markdown,
            spokenSummary: result.spokenSummary,
          },
        };
      },
    }),

    evaluateGovtSchemes: tool({
      description:
        "FULL SUB-AGENT TOOL: Deeply evaluates live subsidy programs (PMEGP, Mudra, PM SVANidhi, CGTMSE) and generates comprehensive multi-scheme eligibility checklists and Swarm tabs. STRICT MUTUAL EXCLUSIVITY: If you call 'evaluateGovtSchemes', DO NOT call the direct tool 'getGovtSchemes' (and vice versa). Never call both!",
      inputSchema: z
        .object({
          schemeName: z
            .string()
            .optional()
            .describe(
              "Specific scheme to evaluate (e.g. 'PMEGP', 'PM Mudra', 'PM SVANidhi', 'PMFME', 'Stand-Up India', or state program)",
            ),
          query: z
            .string()
            .optional()
            .describe(
              "Specific inquiry or focus (e.g. 'subsidy for women', 'documents checklist', 'JanSamarth registration', 'interest rate')",
            ),
          businessSector: z
            .string()
            .optional()
            .describe("Sector (e.g. 'Textiles', 'Food Processing', 'Retail', 'Fabrication')"),
          investmentAmount: z
            .number()
            .optional()
            .describe("Capital required or investment budget in INR"),
          annualTurnover: z
            .number()
            .optional()
            .describe("Annual business turnover in INR"),
          state: z
            .string()
            .optional()
            .describe("State or UT of operation"),
          district: z
            .string()
            .optional()
            .describe("District or city"),
          applicantCategory: z
            .string()
            .optional()
            .describe("Beneficiary category: General, Women, SC/ST, OBC, Minority, Ex-Servicemen"),
          areaType: z
            .enum(["Rural", "Urban", "Semi-Urban"])
            .optional()
            .describe("Rural vs Urban business location"),
          businessStage: z
            .enum(["New", "Expansion", "Modernization"])
            .optional()
            .describe("New enterprise setup vs existing business expansion"),
        })
        .passthrough(),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_schemes`;
        const em = makeEmitter(ctx, "evaluateGovtSchemes", toolCallId, params);
        const result = await runSchemesSubAgent(params, {
          onMarkdown: (md) => em.emit(stableMarkdown(md)),
        });
        em.flush();

        return {
          success: true,
          isArtifact: true,
          artifactType: "govt_schemes",
          title: `Govt Subsidies & Schemes: ${result.businessSector}`,
          summary: result.summary,
          spokenSummary: result.spokenSummary,
          data: {
            ...result,
            content: result.markdown,
            spokenSummary: result.spokenSummary,
          },
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 10. DYNAMIC ON-DEMAND CUSTOM RESEARCH SUB-AGENT
    // ─────────────────────────────────────────────────────────────
    runCustomResearchAgent: tool({
      description:
        "Spawns an on-demand specialized domain research sub-agent tab (e.g. Cold Storage Machinery, FSSAI Licensing, APEDA Food Export, Machinery Capex, Solar Rooftop) with real-time SerpApi web grounding, dynamic markdown dossier, KPI metrics, comparison tables, and interactive calculator.",
      inputSchema: z
        .object({
          tabTitle: z
            .string()
            .describe(
              "Concise tab title e.g. '❄️ Cold Storage', '📜 FSSAI Licensing', '⚡ Solar Rooftop', '📦 Packaging Machinery'",
            ),
          category: z
            .string()
            .describe(
              "Specific commercial sector or equipment domain to research",
            ),
          query: z
            .string()
            .describe("Targeted search query for live SerpApi Google search"),
          location: z
            .string()
            .optional()
            .describe("Target geographical location or state"),
          scaleOrCapacity: z
            .string()
            .optional()
            .describe("Production capacity, machinery specs, or output scale (e.g. 5 tons/day, 50kW, 1000 units/hr)"),
          icon: z
            .enum([
              "factory",
              "shield",
              "truck",
              "package",
              "zap",
              "scale",
              "leaf",
              "cpu",
              "wrench",
              "coins",
            ])
            .optional()
            .default("factory")
            .describe("Icon identifier for the tab header"),
          investmentBudget: z
            .number()
            .optional()
            .describe("Optional investment capital or budget in INR"),
          spokenSummary: z
            .string()
            .optional()
            .describe("1-sentence audio report for voice agent mode"),
        })
        .passthrough(),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_custom`;
        const em = makeEmitter(
          ctx,
          "runCustomResearchAgent",
          toolCallId,
          params,
        );
        const result = await runCustomResearchSubAgent(params, {
          onMarkdown: (md) => em.emit(stableMarkdown(md)),
        });
        em.flush();
        return {
          success: true,
          isArtifact: true,
          isCustomSubAgent: true,
          artifactType: "custom_research",
          tabTitle: result.tabTitle,
          icon: result.icon,
          summary: result.summary,
          spokenSummary: result.spokenSummary,
          data: {
            tabTitle: result.tabTitle,
            category: result.category,
            icon: result.icon,
            content: result.markdown,
            spokenSummary: result.spokenSummary,
            sources: result.sources,
          },
        };
      },
    }),
  };
}

export interface ToolMeta {
  name: string;
  icon:
    | "sprout"
    | "landmark"
    | "globe"
    | "terminal"
    | "search"
    | "document"
    | "image"
    | "file"
    | "camera"
    | "calculator"
    | "layers"
    | "compass"
    | "bar-chart";
  formatSummary: (args: any, result?: any) => string;
}

export const TOOL_DEFINITIONS: Record<string, ToolMeta> = {
  inspectAttachment: {
    name: "inspectAttachment",
    icon: "document",
    formatSummary: (args) =>
      `Read and analyzed "${args?.fileName || "attachment"}"`,
  },
  getArtifacts: {
    name: "getArtifacts",
    icon: "search",
    formatSummary: (args, res) =>
      `Inspected conversation artifacts (${res?.totalCount ?? 0} found)`,
  },
  stageForm: {
    name: "stageForm",
    icon: "landmark",
    formatSummary: (args) =>
      args?.targetArtifactId
        ? `Updated dynamic form "${args?.title || "Form"}"`
        : `Prepared dynamic form "${args?.title || "Form"}"`,
  },
  stageDocument: {
    name: "stageDocument",
    icon: "landmark",
    formatSummary: (args) =>
      args?.targetArtifactId
        ? `Updated document "${args?.title || "Document"}"`
        : `Generated document "${args?.title || "Document"}"`,
  },
  getMandiRates: {
    name: "getMandiRates",
    icon: "sprout",
    formatSummary: (args) =>
      `Queried live APMC rates for ${args?.commodity || "commodities"} in ${args?.state || "India"}`,
  },
  webSearch: {
    name: "webSearch",
    icon: "globe",
    formatSummary: (args) =>
      `Searched web for "${args?.query || "trade intelligence"}"`,
  },
  newsSearch: {
    name: "newsSearch",
    icon: "globe",
    formatSummary: (args) =>
      `Searched Google News for "${args?.query || "trade news"}"`,
  },
  getBudgets: {
    name: "getBudgets",
    icon: "landmark",
    formatSummary: () =>
      "Queried enterprise budget plans",
  },
  getExpenses: {
    name: "getExpenses",
    icon: "landmark",
    formatSummary: (args) =>
      `Queried recent expenses ${args?.category ? `(${args.category})` : ""}`,
  },
  getTransactions: {
    name: "getTransactions",
    icon: "landmark",
    formatSummary: (args) =>
      `Queried master ledger transactions ${args?.type ? `(${args.type})` : ""}`,
  },
  getSavingsGoals: {
    name: "getSavingsGoals",
    icon: "landmark",
    formatSummary: () => "Queried savings targets and plans",
  },
  getDebts: {
    name: "getDebts",
    icon: "landmark",
    formatSummary: () => "Queried active loan liabilities and EMI schedules",
  },
  getBusinessProfile: {
    name: "getBusinessProfile",
    icon: "landmark",
    formatSummary: () => "Queried enterprise profile and turnover records",
  },
  getGovtSchemes: {
    name: "getGovtSchemes",
    icon: "landmark",
    formatSummary: (args) =>
      `Evaluated ${(args?.schemeName || "Credit Scheme").replace(/_/g, " ")} subsidy criteria`,
  },
  searchCompetitors: {
    name: "searchCompetitors",
    icon: "search",
    formatSummary: (args, result) => {
      if (result?.needsLocation) {
        return "Requested device location to scan local competitors...";
      }
      const count = result?.competitors?.length || 0;
      return `Identified ${count} competitor businesses in ${result?.locationSummary || "target area"}`;
    },
  },
  getOndcIntelligence: {
    name: "getOndcIntelligence",
    icon: "globe",
    formatSummary: (args, result) => {
      const src = result?.fromCache ? " (Cached)" : "";
      return `Loaded ONDC Digital Commerce roadmap for ${result?.category || "business"}${src}`;
    },
  },
  predictDistrictBusinesses: {
    name: "predictDistrictBusinesses",
    icon: "landmark",
    formatSummary: (args, result) => {
      const src = result?.fromCache ? " (Cached)" : "";
      return `Researched top 4 business opportunities in ${result?.district || args?.district || "district"}${src}`;
    },
  },
  getRecentFiles: {
    name: "getRecentFiles",
    icon: "document",
    formatSummary: (args, result) =>
      args?.fileId
        ? `Inspected uploaded document "${result?.file?.uploadedName || args.fileId}"`
        : `Checked recent conversation attachments (${result?.totalCount || 0} files found)`,
  },
  evaluateCreditAndEMI: {
    name: "evaluateCreditAndEMI",
    icon: "calculator",
    formatSummary: (args) =>
      `Calculated EMI for ₹${args?.amount?.toLocaleString("en-IN") || "loan"} & scraped bank rates`,
  },
  runSWOTScan: {
    name: "runSWOTScan",
    icon: "layers",
    formatSummary: (args) =>
      `Generated 4-quadrant SWOT matrix for ${args?.category || "business"}`,
  },
  scanCatchmentRadar: {
    name: "scanCatchmentRadar",
    icon: "compass",
    formatSummary: (args, result) =>
      result?.data?.totalFound
        ? `Scanned ${result.data.totalFound} competitors on Google Maps`
        : `Scanned competitors on Google Maps for ${args?.category || "business"}`,
  },
  getMandiArbitrage: {
    name: "getMandiArbitrage",
    icon: "sprout",
    formatSummary: (args) =>
      `Analyzed live APMC yard rates for ${args?.commodity || "crop"}`,
  },
  evaluateGovtSchemes: {
    name: "evaluateGovtSchemes",
    icon: "landmark",
    formatSummary: (args) =>
      `Matched government subsidy programs for ${args?.businessSector || "MSME"}`,
  },
  runCustomResearchAgent: {
    name: "runCustomResearchAgent",
    icon: "layers",
    formatSummary: (args) =>
      `Researched ${args?.tabTitle || args?.category || "custom domain"} with SerpApi Google search`,
  },
  updateBusinessContext: {
    name: "updateBusinessContext",
    icon: "compass",
    formatSummary: (args) =>
      `Remembered business persona: ${args?.businessName || args?.category || "Business"} in ${args?.district || args?.city || "Area"}`,
  },
};
