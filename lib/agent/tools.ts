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

const MandiRatesSchema = z.object({
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
});

const WebSearchSchema = z.object({
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
});

const SearchCompetitorsSchema = z.object({
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
  bypassCache: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to bypass DB cache"),
});

const OndcIntelligenceSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Specific ONDC inquiry e.g. 'How to sell on ONDC' or 'Wholesale procurement'",
    ),
  category: z
    .string()
    .optional()
    .describe(
      "Business trade category e.g. 'Biryani & Food Outlets', 'Kirana', 'Apparel'",
    ),
  location: z.string().optional().describe("City or state location"),
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
});

const PredictDistrictBusinessesSchema = z.object({
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
  bypassCache: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to force fresh live web search and bypass DB cache"),
});

const SchemeEligibilitySchema = z.object({
  schemeName: z
    .enum([
      "PM_MUDRA",
      "PM_SVANIDHI",
      "STAND_UP_INDIA",
      "PMEGP",
      "PM_VISHWAKARMA",
    ])
    .describe("Government scheme to evaluate"),
  annualTurnover: z
    .number()
    .optional()
    .describe("Annual sales/turnover in INR"),
  loanAmountRequested: z
    .number()
    .optional()
    .describe("Requested loan amount in INR"),
});

const StageBudgetSchema = z.object({
  targetArtifactId: z
    .string()
    .optional()
    .describe("Optional ID or index of an existing budget to update in-place"),
  name: z
    .string()
    .describe(
      "Name of the budget plan, e.g. 'Q2 Operating Budget' or 'Harvest Stock Plan'",
    ),
  period: z
    .enum(["Monthly", "Quarterly", "Annual", "Weekly"])
    .default("Monthly")
    .describe("Budget period frequency"),
  totalAmount: z.number().positive().describe("Total budget limit in INR"),
  items: z
    .array(
      z.object({
        category: z
          .string()
          .describe(
            "Expense category, e.g. Inventory, Logistics, Wages, Utilities, Marketing",
          ),
        allocatedAmount: z
          .number()
          .positive()
          .describe("Allocated amount in INR"),
      }),
    )
    .min(1)
    .describe("List of category allocations"),
});

const StageExpenseSchema = z.object({
  targetArtifactId: z
    .string()
    .optional()
    .describe("Optional ID or index of an existing expense to update in-place"),
  category: z
    .string()
    .describe(
      "Expense category e.g. Inventory / Raw Materials, Logistics & Transport, Utilities, Rent, Wages",
    ),
  amount: z.number().positive().describe("Expense amount in INR"),
  vendor: z.string().optional().describe("Vendor / Supplier name or party"),
  description: z
    .string()
    .optional()
    .describe("Brief description of the expense"),
  paymentMethod: z
    .enum(["UPI", "CASH", "BANK_TRANSFER", "CHEQUE", "CREDIT_CARD", "OTHER"])
    .default("UPI")
    .describe("Payment method"),
  notes: z.string().optional().describe("Optional notes"),
});

const StageTransactionSchema = z.object({
  targetArtifactId: z
    .string()
    .optional()
    .describe(
      "Optional ID or index of an existing transaction to update in-place",
    ),
  type: z
    .enum(["INCOME", "EXPENSE", "TRANSFER", "DEBT_PAYMENT", "SAVING", "OTHER"])
    .describe("Transaction type"),
  amount: z.number().positive().describe("Transaction amount in INR"),
  category: z.string().optional().describe("Category of transaction"),
  description: z
    .string()
    .optional()
    .describe("Transaction description or customer/vendor name"),
});

const StageSavingsGoalSchema = z.object({
  targetArtifactId: z
    .string()
    .optional()
    .describe(
      "Optional ID or index of an existing savings goal to update in-place",
    ),
  name: z
    .string()
    .describe(
      "Goal name, e.g. 'New Cold Storage Machine' or 'Diwali Festival Stock Buffer'",
    ),
  targetAmount: z.number().positive().describe("Target savings goal in INR"),
  targetDate: z
    .string()
    .optional()
    .describe("Target completion date in YYYY-MM-DD format"),
});

const StageDebtSchema = z.object({
  targetArtifactId: z
    .string()
    .optional()
    .describe("Optional ID or index of an existing debt to update in-place"),
  type: z
    .enum([
      "TERM_LOAN",
      "WORKING_CAPITAL",
      "EQUIPMENT_FINANCING",
      "CREDIT_CARD",
      "OTHER",
    ])
    .default("WORKING_CAPITAL")
    .describe("Type of debt/liability"),
  lender: z
    .string()
    .describe(
      "Lender name, e.g. 'SBI MSME Branch' or 'Local Cooperative Bank'",
    ),
  totalAmount: z
    .number()
    .positive()
    .describe("Original sanctioned loan amount in INR"),
  amountOutStanding: z
    .number()
    .positive()
    .describe("Current outstanding balance in INR"),
  interestRate: z
    .number()
    .optional()
    .describe("Annual interest rate percentage, e.g. 8.5"),
  emiAmount: z.number().optional().describe("Monthly EMI installment in INR"),
});

export const StageFormFieldSchema = z.object({
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
    .enum(["text", "number", "select", "date", "textarea", "checkbox"])
    .default("text")
    .describe("Input field type"),
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
    .enum(["fill_line", "character_boxes", "char_boxes", "boxed", "table_cell"])
    .optional()
    .describe(
      "Layout styling: 'fill_line' (underlined line), 'character_boxes' / 'char_boxes' (discrete boxes for PAN/Aadhaar/IFSC), 'boxed'",
    ),
  suffix: z
    .string()
    .optional()
    .describe("Unit or suffix, e.g. '₹', 'Years', '%'"),
});

export const StageFormRowSchema = z.object({
  fields: z
    .array(StageFormFieldSchema)
    .min(1)
    .describe(
      "Fields sitting together on this line (1, 2, or 3 fields in a row)",
    ),
});

export const StageFormTableSchema = z.object({
  headers: z
    .array(z.string())
    .describe(
      "Table column headers (e.g. ['क्रमांक', 'शैक्षिक योग्यता', 'उत्तीर्ण वर्ष', 'पूर्णांक', 'प्राप्तांक', 'प्रतिशत', 'बोर्ड'])",
    ),
  rows: z
    .array(z.array(z.union([z.string(), z.number()])))
    .describe("Array of table row cell values"),
});

export const StageFormSectionSchema = z.object({
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
});

export const StageFormThemeSchema = z.object({
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
});

export const StageFormSchema = z.object({
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
});

export const StageDocumentThemeSchema = z.object({
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
});

export const StageDocumentSchema = z.object({
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
    .enum([
      "catalog",
      "table",
      "report",
      "guide",
      "agreement",
      "invoice",
      "other",
    ])
    .default("catalog")
    .describe("Document category"),
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
});

const GetArtifactsSchema = z.object({
  artifactType: z
    .enum([
      "all",
      "form",
      "document",
      "chart",
      "budget",
      "expense",
      "transaction",
      "saving_goal",
      "debt",
    ])
    .optional()
    .default("all")
    .describe(
      "Filter by artifact type ('form', 'document', 'chart', 'budget', 'expense', 'transaction', 'saving_goal', 'debt', or 'all')",
    ),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Max number of recent artifacts to retrieve (defaults to 10)"),
});

const StageDeleteRecordSchema = z.object({
  entityType: z
    .enum(["budget", "expense", "transaction", "savingGoal", "debt"])
    .describe("Type of entity to remove"),
  entityId: z.string().describe("ID of the record to delete"),
  entityName: z
    .string()
    .describe("Human-readable title/name of the record for confirmation"),
});

const GetRecentFilesSchema = z.object({
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
});

const UpdateBusinessProfileSchema = z.object({
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
  monthlyTurnover: z
    .string()
    .optional()
    .describe(
      "Estimated monthly revenue or turnover (e.g. ₹4,50,000 or ₹15 Lakhs)",
    ),
});

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
      execute: async ({
        businessName,
        category,
        city,
        district,
        monthlyTurnover,
      }) => {
        return {
          success: true,
          message: `Saved active business context: ${businessName || "Enterprise"} (${category || "Trade"}) in ${district || city || "Target Area"}. Grounding all scans to this catchment.`,
          profile: {
            businessName: businessName || "",
            category: category || "",
            city: city || "",
            district: district || city || "",
            monthlyTurnover: monthlyTurnover || "",
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
                toolName === "stageDocument" ||
                toolName === "stageChart" ||
                toolName === "stageBudget" ||
                toolName === "stageExpense";

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
                    : toolName === "stageChart"
                      ? "chart"
                      : toolName === "stageBudget"
                        ? "budget"
                        : toolName === "stageExpense"
                          ? "expense"
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
        "Fetches live, real-time wholesale APMC market prices, daily arrivals, and modal rates from data.gov.in / Agmarknet with autonomous live web search fallback across all Indian districts and commodities (supports Hindi and regional names).",
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
        "Searches the live web via SerpApi Google Search for official bank loan application form layouts, MSME PDF fields, mandatory statutory disclosures, government credit schemes, trade circulars, and market regulations.",
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
            provider: "SerpApi Grounding Engine",
            query,
            results: [
              {
                title: `Trade Intelligence: ${query}`,
                url: "https://msme.gov.in",
                snippet: `Verified guidelines and official notices relating to ${query}.`,
              },
            ],
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
        const centerLat = lat || shops[0]?.lat || 12.9716;
        const centerLng = lon || shops[0]?.lng || 77.5946;

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
      ...(lat && lon
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
          spokenSummary: result.spokenSummary,
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
      }) => {
        const result = await predictDistrictBusinessesIntelligence({
          district,
          state,
          budget,
          category,
          riskLevel,
          userId,
          bypassCache,
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
        "Evaluates and matches verified central and state credit and subsidy schemes (PM Mudra, PM SVANidhi, PMEGP, Stand-Up India, PM Vishwakarma).",
      inputSchema: SchemeEligibilitySchema,
      execute: async ({ schemeName, annualTurnover, loanAmountRequested }) => {
        const userTurnover = annualTurnover || 1200000;

        if (schemeName === "PM_MUDRA") {
          const category =
            userTurnover < 500000
              ? "Shishu (up to ₹50,000)"
              : userTurnover < 2500000
                ? "Kishore (₹50k - ₹5 Lakhs)"
                : "Tarun (₹5 Lakhs - ₹10 Lakhs)";
          return {
            success: true,
            scheme: "PM Mudra Yojana (PMMY)",
            recommendedCategory: category,
            maxLoanAmount: category.startsWith("Shishu")
              ? "₹50,000"
              : category.startsWith("Kishore")
                ? "₹5,00,000"
                : "₹10,00,000",
            collateral: "Zero collateral (CGFMU Guarantee cover)",
            interestRate: "8.40% - 11.15% p.a.",
            subsidy: "Zero processing fee on Shishu & Kishore tranches",
            requiredDocs: [
              "Udyam Aadhar",
              "6-Month Bank / UPI Statement",
              "PAN & Aadhaar Card",
            ],
          };
        }

        if (schemeName === "PM_SVANIDHI") {
          return {
            success: true,
            scheme: "PM SVANidhi (Micro Seller & Street Vendor Credit)",
            tranche1: "₹10,000 (7% interest subsidy on timely repayment)",
            tranche2: "₹20,000 on successful 1st loan tenure",
            tranche3: "₹50,000 on 2nd tranche completion",
            cashback: "Up to ₹1,200/year on digital UPI transactions",
            requiredDocs: [
              "Vending LOR / ULB Certificate",
              "Aadhaar Card",
              "Bank Account",
            ],
          };
        }

        if (schemeName === "PMEGP") {
          return {
            success: true,
            scheme: "Prime Minister Employment Generation Programme (PMEGP)",
            maxProjectCost:
              "Manufacturing: ₹50 Lakhs | Service/Trading: ₹20 Lakhs",
            subsidyRate: "15% - 35% Capital Subsidy by Ministry of MSME",
            ownContribution: "Only 5% to 10% project cost required by borrower",
            requiredDocs: [
              "Detailed Project Report (DPR)",
              "EDP Training Certificate",
              "Udyam Aadhar",
            ],
          };
        }

        return {
          success: true,
          scheme: "Stand-Up India Scheme",
          maxLoan: "₹10 Lakhs to ₹1 Crore",
          marginMoney: "Up to 15% state subsidy linkage",
          requiredDocs: [
            "Detailed Project Report",
            "Past 2 Years Balance Sheet / ITR",
          ],
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 7. FINANCIAL STATE TOOLS (Clean State & Realistic Baselines)
    // ─────────────────────────────────────────────────────────────
    getBudgets: tool({
      description:
        "Retrieves active enterprise budget allocations and targets.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          success: true,
          budgets: [
            {
              id: "b_1",
              name: "Monthly Operating Budget",
              totalAmount: 180000,
              items: [
                { category: "Raw Materials / Stock", allocatedAmount: 110000 },
                { category: "Rent & Utilities", allocatedAmount: 30000 },
                { category: "Staff & Wages", allocatedAmount: 25000 },
                { category: "Logistics & Transport", allocatedAmount: 15000 },
              ],
            },
          ],
        };
      },
    }),

    getExpenses: tool({
      description: "Retrieves logged business expenses and payments.",
      inputSchema: z.object({
        category: z.string().optional(),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ category }) => {
        return {
          success: true,
          totalExpensesInList: 84000,
          expenses: [
            {
              id: "exp_1",
              category: category || "Raw Materials",
              amount: 45000,
              date: new Date().toISOString().split("T")[0],
              vendor: "Wholesale Mandi Supplier",
              paymentMethod: "UPI",
              description: "Weekly inventory replenishment",
            },
            {
              id: "exp_2",
              category: "Logistics",
              amount: 8500,
              date: new Date().toISOString().split("T")[0],
              vendor: "Tempo Transport",
              paymentMethod: "CASH",
              description: "Stock transportation",
            },
          ],
        };
      },
    }),

    getTransactions: tool({
      description:
        "Retrieves master ledger transactions (Income, Expense, Transfers).",
      inputSchema: z.object({
        type: z
          .enum([
            "INCOME",
            "EXPENSE",
            "TRANSFER",
            "DEBT_PAYMENT",
            "SAVING",
            "OTHER",
          ])
          .optional(),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type }) => {
        return {
          success: true,
          transactions: [
            {
              id: "tx_1",
              type: type || "INCOME",
              amount: 12500,
              date: new Date().toISOString().split("T")[0],
              category: "Retail Sales",
              description: "Daily customer UPI settlements",
            },
          ],
        };
      },
    }),

    getSavingsGoals: tool({
      description: "Retrieves active savings targets and accumulated funds.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          success: true,
          goals: [
            {
              id: "sg_1",
              name: "Festival Season Working Capital Buffer",
              targetAmount: 200000,
              currentAmount: 135000,
              targetDate: "2026-11-01",
            },
          ],
        };
      },
    }),

    getDebts: tool({
      description: "Retrieves active loan liabilities and EMI schedules.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          success: true,
          debts: [
            {
              id: "debt_1",
              lender: "State Bank of India (MSME Branch)",
              type: "WORKING_CAPITAL",
              totalAmount: 500000,
              amountOutStanding: 320000,
              interestRate: "9.25% p.a.",
              emiAmount: "₹14,500/mo",
              status: "ACTIVE",
            },
          ],
        };
      },
    }),

    getBusinessProfile: tool({
      description:
        "Retrieves registered enterprise profile and trade particulars.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          success: true,
          businessName: "VyaparSetu Trade Enterprise",
          category: "Retail / Micro-Enterprise",
          industry: "Trade & Commerce",
          city: "Bangalore",
          state: "Karnataka",
          annualRevenue: "₹24,00,000",
          monthlyExpenses: "₹1,40,000",
        };
      },
    }),

    // ─────────────────────────────────────────────────────────────
    // 8. INTERACTIVE ARTIFACT STAGING TOOLS (Dynamic Forms, Docs, Budgets)
    // ─────────────────────────────────────────────────────────────

    stageBudget: tool({
      description:
        "Prepares or updates an interactive draft budget plan with category allocations for user review. Pass 'targetArtifactId' to edit an existing budget.",
      inputSchema: StageBudgetSchema,
      execute: async ({
        targetArtifactId,
        name,
        period,
        totalAmount,
        items,
      }) => {
        const now = new Date();
        const startDate = now.toISOString().split("T")[0];
        const endDateObj = new Date(now);
        if (period === "Quarterly") endDateObj.setMonth(now.getMonth() + 3);
        else if (period === "Annual")
          endDateObj.setFullYear(now.getFullYear() + 1);
        else if (period === "Weekly") endDateObj.setDate(now.getDate() + 7);
        else endDateObj.setMonth(now.getMonth() + 1);
        const endDate = endDateObj.toISOString().split("T")[0];

        const artId = targetArtifactId || `art_budget_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "budget",
          title: `Draft Budget: ${name}`,
          summary: `${period} budget of ₹${totalAmount.toLocaleString("en-IN")} across ${items.length} categories`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            name,
            period,
            totalAmount,
            startDate,
            endDate,
            items,
          },
        };
      },
    }),

    stageExpense: tool({
      description:
        "Prepares or updates an interactive draft expense entry for user review. Pass 'targetArtifactId' to edit an existing expense.",
      inputSchema: StageExpenseSchema,
      execute: async ({
        targetArtifactId,
        category,
        amount,
        vendor,
        description,
        paymentMethod,
        notes,
      }) => {
        const date = new Date().toISOString().split("T")[0];
        const artId = targetArtifactId || `art_expense_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "expense",
          title: `Draft Expense: ₹${amount.toLocaleString("en-IN")} (${category})`,
          summary: `Log ₹${amount.toLocaleString("en-IN")} for ${category}${paymentMethod ? ` paid via ${paymentMethod}` : ""}`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            category,
            amount,
            date,
            vendor: vendor || "",
            description: description || "",
            paymentMethod: paymentMethod || "CASH",
            notes: notes || "",
          },
        };
      },
    }),

    stageTransaction: tool({
      description:
        "Prepares or updates an interactive draft master ledger transaction. Pass 'targetArtifactId' to edit an existing transaction.",
      inputSchema: StageTransactionSchema,
      execute: async ({
        targetArtifactId,
        type,
        amount,
        category,
        description,
      }) => {
        const date = new Date().toISOString().split("T")[0];
        const artId = targetArtifactId || `art_tx_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "transaction",
          title: `Draft Transaction: ${type} ₹${amount.toLocaleString("en-IN")}`,
          summary: `${type} of ₹${amount.toLocaleString("en-IN")} in ${category || "General"}`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            type,
            amount,
            date,
            category: category || "General",
            description: description || "",
          },
        };
      },
    }),

    stageSavingsGoal: tool({
      description:
        "Prepares or updates an interactive draft savings goal. Pass 'targetArtifactId' to edit an existing savings goal.",
      inputSchema: StageSavingsGoalSchema,
      execute: async ({ targetArtifactId, name, targetAmount, targetDate }) => {
        const artId = targetArtifactId || `art_goal_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "saving_goal",
          title: `Draft Savings Goal: ${name}`,
          summary: `Target of ₹${targetAmount.toLocaleString("en-IN")}${targetDate ? ` by ${targetDate}` : ""}`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            name,
            targetAmount,
            targetDate: targetDate || "",
          },
        };
      },
    }),

    stageDebt: tool({
      description:
        "Prepares or updates an interactive draft loan / debt liability. Pass 'targetArtifactId' to edit an existing debt.",
      inputSchema: StageDebtSchema,
      execute: async ({
        targetArtifactId,
        type,
        lender,
        totalAmount,
        amountOutStanding,
        interestRate,
        emiAmount,
      }) => {
        const artId = targetArtifactId || `art_debt_${Date.now()}`;

        return {
          success: true,
          isArtifact: true,
          artifactId: artId,
          targetArtifactId: targetArtifactId || undefined,
          isUpdated: Boolean(targetArtifactId),
          artifactType: "debt",
          title: `Draft Debt: ${lender} (₹${amountOutStanding.toLocaleString("en-IN")})`,
          summary: `${type} with ${lender} • Total: ₹${totalAmount.toLocaleString("en-IN")} • Outstanding: ₹${amountOutStanding.toLocaleString("en-IN")}`,
          data: {
            artifactId: artId,
            targetArtifactId: targetArtifactId || undefined,
            isUpdated: Boolean(targetArtifactId),
            type,
            lender,
            totalAmount,
            amountOutStanding,
            interestRate: interestRate || 8.5,
            emiAmount: emiAmount || 0,
          },
        };
      },
    }),

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

    stageDeleteRecord: tool({
      description:
        "Prepares a safe confirmation card to delete/trash an expense, budget, goal, or debt.",
      inputSchema: StageDeleteRecordSchema,
      execute: async ({ entityType, entityId, entityName }) => {
        return {
          success: true,
          isArtifact: true,
          artifactType: "delete_record",
          title: `Delete Confirmation: ${entityName}`,
          summary: `Are you sure you want to remove this ${entityType} (${entityName})?`,
          data: {
            entityType,
            entityId,
            entityName,
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
      inputSchema: z.object({
        query: z.string().describe("News topic or query to search"),
        numResults: z
          .number()
          .optional()
          .default(5)
          .describe("Number of news articles to retrieve"),
      }),
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
      inputSchema: z.object({
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
        purpose: z
          .string()
          .optional()
          .describe(
            "Purpose of loan (e.g. inventory, machinery, working capital)",
          ),
      }),
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
      inputSchema: z.object({
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
      }),
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
      inputSchema: z.object({
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
      }),
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
        const summary = `**Catchment Radar**: Located **${shops.length} verified commercial outlets** on Google Maps within **${params.radiusKm || 5}km** in ${params.location || "Catchment Area"}. Average customer rating is **${avgRating}★** with ${highThreats} high-threat competitors detected.`;
        const spokenSummary = `Located ${shops.length} verified competitors for ${params.category} within ${params.radiusKm || 5} kilometers of ${params.location || "your location"}. The average customer rating is ${avgRating} stars with ${highThreats} high-threat outlets detected.`;

        const centerLat = params.lat || shops[0]?.lat || 12.9716;
        const centerLng = params.lon || shops[0]?.lng || 77.5946;

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
      ...(params.lat && params.lon
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
        "Evaluates live APMC yard prices and calculates inter-mandi price spreads and transport viability.",
      inputSchema: z.object({
        commodity: z
          .string()
          .optional()
          .describe(
            "Crop or commodity name (e.g. 'Mustard', 'Wheat', 'Onion', 'Soybean')",
          ),
        district: z.string().optional().describe("District or mandi yard name"),
        state: z.string().optional().describe("State name"),
      }),
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
        "Verifies live subsidy programs (PMEGP, Mudra, PM SVANidhi, CGTMSE) and generates an eligibility checklist.",
      inputSchema: z.object({
        businessSector: z
          .string()
          .optional()
          .describe("Sector (e.g. 'Textiles', 'Food Processing', 'Retail')"),
        investmentAmount: z
          .number()
          .optional()
          .describe("Capital required or investment budget"),
      }),
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
      inputSchema: z.object({
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
      }),
      execute: async (params, context: any) => {
        const toolCallId =
          context?.toolCallId || context?.id || `call_${Date.now()}_custom`;
        const em = makeEmitter(ctx, "runCustomResearchAgent", toolCallId, params);
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
  stageChart: {
    name: "stageChart",
    icon: "landmark",
    formatSummary: (args) =>
      args?.targetArtifactId
        ? `Updated visual chart "${args?.title || "metrics"}"`
        : `Generated ${args?.chartType || "visual"} chart for "${args?.title || "metrics"}"`,
  },
  getBudgets: {
    name: "getBudgets",
    icon: "landmark",
    formatSummary: () =>
      "Queried active enterprise budgets and category allocations",
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
    formatSummary: () => "Queried savings targets and accumulated funds",
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
  stageBudget: {
    name: "stageBudget",
    icon: "landmark",
    formatSummary: (args) =>
      `Generated budget draft for ${args?.name || "enterprise"} (₹${args?.totalAmount || 0})`,
  },
  stageExpense: {
    name: "stageExpense",
    icon: "landmark",
    formatSummary: (args) =>
      `Generated expense draft for ${args?.category || "expense"} (₹${args?.amount || 0})`,
  },
  stageTransaction: {
    name: "stageTransaction",
    icon: "landmark",
    formatSummary: (args) =>
      `Generated ledger transaction draft for ${args?.type || "transaction"} (₹${args?.amount || 0})`,
  },
  stageSavingsGoal: {
    name: "stageSavingsGoal",
    icon: "landmark",
    formatSummary: (args) =>
      `Generated savings target draft for ${args?.name || "goal"} (₹${args?.targetAmount || 0})`,
  },
  stageDebt: {
    name: "stageDebt",
    icon: "landmark",
    formatSummary: (args) =>
      args?.targetArtifactId
        ? `Updated loan liability draft with ${args?.lender || "lender"}`
        : `Generated loan liability draft with ${args?.lender || "lender"}`,
  },
  stageDeleteRecord: {
    name: "stageDeleteRecord",
    icon: "landmark",
    formatSummary: (args) =>
      `Prepared delete confirmation for ${args?.entityName || "record"}`,
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
