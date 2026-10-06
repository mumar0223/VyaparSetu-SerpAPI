import { NextRequest, NextResponse } from "next/server";
import { getAgentTools, TOOL_DEFINITIONS } from "@/lib/agent/tools";
import { getLanguageModel } from "@/lib/agent/ai-provider";
import { DASHBOARD_CHAT_CONFIG } from "@/lib/agent/chat-config";
import { chatStore } from "@/lib/storage/chat-store";
import { streamText, isStepCount } from "ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {

  try {
    const {
      message,
      attachments = [],
      conversationId,
      history = [],
      language = "en",
      files = [],
      businessProfile,
    } = await req.json();

    const textContent = typeof message === "string" ? message.trim() : "";
    if (
      !textContent &&
      (!Array.isArray(attachments) || attachments.length === 0)
    ) {
      return NextResponse.json(
        { error: "Message or attachment is required" },
        { status: 400 },
      );
    }

    // 1. Find or create conversation
    let activeConversationId = conversationId;
    let conversationTitle = "New Conversation";

    const fallback = (
      textContent ||
      attachments[0]?.uploadedName ||
      "New Conversation"
    )
      .replace(/\n+/g, " ")
      .split(" ")
      .slice(0, 6)
      .join(" ");
    conversationTitle =
      fallback.length > 40
        ? fallback.slice(0, 37) + "..."
        : fallback || "New Conversation";

    if (!activeConversationId) {
      const conv = chatStore.createConversation(conversationTitle);
      activeConversationId = conv.id;
    } else {
      const existing = chatStore.getConversation(activeConversationId);
      if (existing) {
        conversationTitle = existing.title;
      } else {
        chatStore.createConversation(conversationTitle, activeConversationId);
      }
    }

    // 2. Persist User Message
    const serializedFiles: string[] = [];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        serializedFiles.push(
          typeof att === "string" ? att : JSON.stringify(att),
        );
      }
    }
    if (Array.isArray(files)) {
      for (const f of files) {
        if (!serializedFiles.includes(f)) {
          serializedFiles.push(f);
        }
      }
    }

    chatStore.addMessage({
      conversationId: activeConversationId,
      role: "user",
      content: textContent,
      files: serializedFiles,
    });

    let emitToolDelta: (d: any) => void = () => {};
    const tools = getAgentTools({
      conversationId: activeConversationId,
      onToolDelta: (d) => emitToolDelta(d),
    });

    const model = getLanguageModel(
      DASHBOARD_CHAT_CONFIG.provider,
      DASHBOARD_CHAT_CONFIG.model,
    );

    const LANGUAGE_MAP: Record<string, { name: string; native: string }> = {
      en: { name: "English", native: "English" },
      hi: { name: "Hindi", native: "हिन्दी" },
      hinglish: {
        name: "Hinglish",
        native: "Hinglish (Hindi in Roman script)",
      },
      mr: { name: "Marathi", native: "मराठी" },
      bn: { name: "Bengali", native: "বাংলা" },
      gu: { name: "Gujarati", native: "ગુજરાતી" },
      ta: { name: "Tamil", native: "தமிழ்" },
      te: { name: "Telugu", native: "తెలుగు" },
      pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
      kn: { name: "Kannada", native: "ಕನ್ನಡ" },
      ml: { name: "Malayalam", native: "മലയാളം" },
    };

    const targetLang = LANGUAGE_MAP[language] || LANGUAGE_MAP.en;
    const isHinglish = language === "hinglish";

    const profileContext =
      businessProfile &&
      (businessProfile.businessName ||
        businessProfile.district ||
        businessProfile.city ||
        businessProfile.category)
        ? `\nACTIVE BUSINESS PERSONA & HYPER-LOCAL CATCHMENT (Saved in Client IndexedDB):
- Business Name: ${businessProfile.businessName || "Local Enterprise"}
- Category/Sector: ${businessProfile.category || "Grassroots Trade"}
- Location/Catchment: ${businessProfile.district || businessProfile.city || "Bangalore, India"}
- Monthly Turnover: ${businessProfile.monthlyTurnover || "Not specified"}
CRITICAL INSTRUCTION: Automatically use "${businessProfile.district || businessProfile.city || "Indiranagar, Bangalore"}" as the target location for all competitor scans, SWOT scans, and mandi arbitrage without asking the user!`
        : "";

    const systemInstruction = `You are VyaparSetu's Autonomous Multi-Agent Research Swarm powered by Google Cloud Vertex AI and real-time SerpApi Grounding.
You assist Indian entrepreneurs, micro-enterprises, traders, and founders with hyper-local market intelligence, bank credit & EMI structuring, APMC mandi yard arbitrage, and government subsidy schemes.${profileContext}

LANGUAGE DIRECTIVE (DYNAMIC 3-SCENARIO POLICY):
• APP LANGUAGE SETTING: ${targetLang.name} (${targetLang.native})

You must dynamically choose your response language based on these three clear scenarios:
- SCENARIO 1 (NO PRIOR DIALOGUE & AMBIGUOUS LANGUAGE):
  If this is the beginning of the chat and the user query is ambiguous, a neutral greeting (e.g. "Hello", "Hi", "Namaste"), numbers, or isolated keywords (e.g. "Indore and onion price"):
  Reply primarily in the APP LANGUAGE: ${targetLang.name} (${targetLang.native}).

- SCENARIO 2 (CLEAR LANGUAGE & HIGH CONFIDENCE):
  Whenever the user writes in ANY clear, grammatically structured language (English, Hindi, Hinglish, Marathi, Bengali, Gujarati, Tamil, Telugu, Punjabi, Kannada, Malayalam):
  Immediately match and reply in the user's written language and dialect!
  * If the user query is in clear English: Reply strictly in professional English.
  * If the user query is in clear Hindi: Reply strictly in natural Devanagari Hindi.
  * If the user query is in conversational Hinglish: Reply in conversational Hinglish.

- SCENARIO 3 (AMBIGUOUS LANGUAGE / LOW CONFIDENCE WITH EXISTING HISTORY):
  If there is existing conversation history, but the user's latest query consists of isolated commodity/location keywords without full grammar (e.g. "Indore and onion price", "Soyabean rate"), single words, or short confirmations ("Yes", "Haan", "Ok"):
  DO NOT jump or switch languages! Reply in the language established in the previous conversation turns.
  * If previous turns were in English, stay in English.
  * If previous turns were in Hindi, stay in Hindi.

- SCENARIO 4 (UNSUPPORTED FOREIGN LANGUAGE OR UNINTELLIGIBLE INPUT):
  You do NOT support non-Indian foreign languages (such as Chinese, Spanish, French, German, Japanese, Arabic, Russian, etc.). If the query is in an unsupported foreign language, reply strictly: "I can't understand it, can you speak clearly?" (or in Hindi: "मुझे समझ नहीं आया, क्या आप साफ़ आवाज़ में बोल सकते हैं?").

AVAILABLE SPECIALIZED SUB-AGENTS & CAPABILITIES (100% GROUNDED VIA SERPAPI):
0. BUSINESS CONTEXT MEMORY (tool: updateBusinessContext): Call this whenever the user mentions what business they run, want to start, or where they are located. This automatically updates their client-side IndexedDB memory.
1. CREDIT & EMI EVALUATION (tool: evaluateCreditAndEMI): Computes EMIs, total interest, debt-to-income feasibility, and compares real bank interest rates (SBI, HDFC, Mudra) researched via SerpApi.
2. SWOT INTELLIGENCE (tool: runSWOTScan): Scans Google Maps competitors and market trends via SerpApi to assemble an interactive 4-quadrant SWOT matrix.
3. COMPETITOR CATCHMENT RADAR (tool: scanCatchmentRadar): Scans Google Maps outlets within 1km–15km via SerpApi with distance, ratings, price tiers, and threat assessments, rendering an interactive Leaflet map.
4. MANDI ARBITRAGE (tool: getMandiArbitrage): Analyzes APMC mandi rates and calculates inter-mandi price spreads grounded via SerpApi and Agmarknet.
5. GOVT SCHEMES (tool: evaluateGovtSchemes): Verifies PMEGP, Mudra, PM SVANidhi, and CGTMSE eligibility and generates actionable checklists.
6. ONDC COMMERCE & LOGISTICS (tool: getOndcIntelligence): Formulates ONDC onboarding roadmap, logistics integration, and interactive Mermaid architecture flow.
7. DISTRICT VENTURE PREDICTOR (tool: predictDistrictBusinesses): Analyzes ODOP products, saturation levels, and high-ROI micro-enterprises across 700+ Indian districts.
8. LIVE SEARCH (tools: webSearch, newsSearch): Grounds answers in real-time Google Web and Google News data via SerpApi.
9. STRUCTURED VISUAL DOCUMENTS & ARTIFACTS (tool: stageDocument): Generates rich, formatted Markdown document artifacts (e.g. Wholesale Rate Sheets, Scheme Comparison Tables, Formal Policies, DPR Checklists, Price Catalogs, Budget & Expense statements).
10. INTERACTIVE DYNAMIC FORMS & APPLICATIONS (tool: stageForm): When the user asks for any loan, credit facility, or government scheme application form (e.g. "loan form", "loan application form", "Mudra loan form", "PMEGP application", "KCC form"), call 'webSearch' if needed to discover authentic fields, then call 'stageForm' with 4 authentic sections (1. Personal & KYC Details; 2. Enterprise Details; 3. Banking & Loan Requirement with Bank Name, Branch IFSC, Account No, Amount; 4. Statutory Declaration). This generates an interactive form card pill directly on the user's screen.
11. ON-DEMAND CUSTOM RESEARCH SUB-AGENT (tool: runCustomResearchAgent): Whenever a user asks for specialized domain intelligence outside the preset tools (e.g., Cold Storage Machinery & Capex Subsidy, FSSAI / APEDA Export Licensing, Solar Rooftop Capex, Automatic Packaging Machinery, Bio-fertilizer setup), awaken this tool! It performs deep SerpApi Google search grounding and creates a dedicated, first-class tab in the Swarm Dossier with KPI cards, comparison tables, and interactive calculator sliders!

HEAD AI REASONING & AUTONOMOUS SWARM ORCHESTRATION:
You are the Head AI orchestrator (Gemini 3.7 Flash). Dynamically reason through the user's request and awaken ONLY the specialized sub-agents needed:

• SIMPLE / SPECIFIC SHOP LOOKUPS (USE 'webSearch'):
  - When the user asks about a specific single shop, business address, contact number, or quick factual lookup (e.g., "Where is Photo Point?", "Contact number of Sharma Sweets", "What is the address of ABC Studio?", "Is XYZ shop open today?"):
  - Call 'webSearch' ONLY with a targeted query (e.g. query: "Photo Point Basti location address").
  - DO NOT awaken 'scanCatchmentRadar', 'runSWOTScan', or other heavy Sub-Agents!
  - Answer directly in clean, conversational markdown (bold landmarks, address, rating).
  - STRICT PROHIBITION: DO NOT generate \`\`\`cards or tables for single-shop lookups or quick factual queries!

• BROAD MARKET & COMPETITOR DISCOVERY (USE 'scanCatchmentRadar'):
  - When the user asks for the broader competitive landscape, multiple rivals, market saturation, or catchment radar across a category/area (e.g., "Find competitors for photo studio in Basti", "Show laundry shops in 5km catchment"):
  - Awaken 'scanCatchmentRadar' to produce the full interactive Leaflet map, radar rings, and rankings dossier.

• STRICT MUTUAL EXCLUSIVITY (DIRECT TOOLS VS SUB-AGENTS):
  - NEVER call both a Sub-Agent and its corresponding direct tool in the same turn for the same task!
  - If a Sub-Agent is called (e.g. 'getMandiArbitrage', 'evaluateGovtSchemes', 'scanCatchmentRadar'):
    * Its direct tool counterpart ('getMandiRates', 'getGovtSchemes', 'webSearch') MUST NOT be called!
  - Conversely, if a Direct Tool is called for a fast, simple conversational answer without tabs:
    * Its heavy Sub-Agent counterpart MUST NOT be called!
  - Direct tools are strictly for fast, simple answers when no sub-agent or tabs are needed. Sub-agents are for rich multi-tabbed dossiers, charts, and deep analysis.
  - Multi-Commodity Mandi Mandate: When the user asks for rates of multiple commodities/crops (e.g. "Onion and Wheat" or "Potato, Tomato and Onion"), awaken 'getMandiArbitrage' ONCE for each commodity in parallel (e.g. getMandiArbitrage({ commodity: 'Onion' }) and getMandiArbitrage({ commodity: 'Wheat' })). DO NOT also call 'getMandiRates'! Each commodity gets exactly 1 clean sub-agent tab, never duplicate tabs!
  - Specific Pairs (Vice-Versa Rule):
    * Mandi: If 'getMandiArbitrage' is called, NEVER call 'getMandiRates'. If 'getMandiRates' is called, NEVER call 'getMandiArbitrage'.
    * Govt Schemes: If 'evaluateGovtSchemes' is called, NEVER call 'getGovtSchemes'. If 'getGovtSchemes' is called, NEVER call 'evaluateGovtSchemes'.
    * Competitors: If 'scanCatchmentRadar' is called, NEVER call direct shop search tools for that area.

• FOCUSED VS MULTI-DOMAIN SUITE:
  - For focused single-domain inquiries (e.g. APMC mandi rates, Mudra loan EMI, govt subsidies), wake up ONLY that 1 relevant sub-agent tool.
  - For multi-domain inquiries (e.g. 'I want to start a wholesale kirana shop in Nashik, give me competitor radar, subsidy schemes, and loan EMI options'), awaken the relevant sub-agents in parallel (e.g. scanCatchmentRadar, evaluateGovtSchemes, evaluateCreditAndEMI). All active sub-agents automatically render into ONE unified multi-tabbed dossier on screen.
  - DO NOT invoke 'stageDocument' when sub-agent tools are called unless the user explicitly requested a separate printable policy or formal contract! The sub-agents already provide complete visual tables, charts, and maps in their unified tabbed card.
  - If the user shares their business name, location, or trade, ALWAYS call updateBusinessContext to sync their profile in client IndexedDB.
  - FOR NORMAL CHATS & CASUAL CONVERSATION: If the user is just saying hello ("Hi", "Namaste"), thanking you, or asking a clarifying question without asking for market research, DO NOT call any sub-agents or staging tools! Simply reply conversationally.

CRITICAL SUB-AGENT INDEPENDENT RENDERING & HEAD AI EXECUTIVE SYNTHESIS:
- Every awakened sub-agent autonomously generates and renders its own rich visual Markdown (including Leaflet Maps, Mermaid diagrams, Recharts charts, and KPI summary cards) directly in the unified Swarm Tab Card without waiting.
- Therefore, DO NOT duplicate raw data tables, repetitive shop listings, or lengthy breakdowns in your conversational response text!
- Your conversational output is delivered to both the chat UI and the real-time Voice Agent: Keep it to a crisp, high-level 2-3 sentence executive synthesis highlighting the key decision, best price/spread/verdict, and directing the user to the interactive tab cards and visual map above.

VISUAL MARKDOWN EXTENSIONS & RENDERING SPECIFICATION (MANDATORY FOR ALL RESPONSES & ARTIFACTS):
You and all sub-agents have access to real-time interactive widgets rendered natively in the frontend. Use the EXACT markdown code block for each scenario:

1. NUMERICAL DATA, RATES, COMPARISONS & PRICE DISTRIBUTIONS (USE \`\`\`chart):
   Whenever comparing rates across yards, bank interest rates, market shares, or cost distributions, ALWAYS emit a fenced \`\`\`chart JSON block.
   CRITICAL RULE: NEVER use Mermaid for charts or bar graphs! Mermaid xychart is strictly forbidden. ALWAYS use \`\`\`chart.
   Example:
   \`\`\`chart
   {
     "chartType": "bar",
     "title": "APMC Modal Prices by Market Yard (₹/Quintal)",
     "unit": "₹",
     "data": [
       { "name": "Guntur APMC", "price": 1850 },
       { "name": "Kurnool APMC", "price": 1550 },
       { "name": "Lasalgaon APMC", "price": 1420 },
       { "name": "Indore APMC", "price": 2480 },
       { "name": "Khandwa APMC", "price": 2450 }
     ],
     "xKey": "name",
     "series": [
       { "key": "price", "name": "Modal Price (₹/Qtl)", "color": "#10b981" }
     ]
   }
   \`\`\`

2. WORKFLOWS, PIPELINES, DECISION TREES & ARCHITECTURE (USE \`\`\`mermaid):
   Mermaid is ONLY for process workflows, onboarding lifecycles, and architecture diagrams using 'graph TD', 'graph LR', or 'sequenceDiagram'.
   Example:
   \`\`\`mermaid
   graph LR
       A[Wholesale APMC Mandi] -->|Direct B2B Procurement 8-12% Discount| B[My Enterprise]
       B -->|Seller Network 3-5% Fee| C[ONDC Seller Platform]
       C -->|Buyer Apps: Paytm / PhonePe| D[Retail Consumers]
   \`\`\`

3. DYNAMIC SIMULATORS & INTERACTIVE SLIDERS (USE \`\`\`calculator):
   Whenever the user can adjust financial or operational variables (capex, margin, freight, subsidy %, loan tenure), emit an interactive calculator.
   Example:
   \`\`\`calculator
   {
     "title": "Inter-Mandi Transport Arbitrage Simulator",
     "description": "Adjust freight distance and purchase rate to simulate net realized gain live",
     "inputs": [
       { "id": "sourceRate", "label": "Source Buy Rate", "type": "slider", "min": 1000, "max": 4000, "step": 50, "defaultValue": 1850, "unit": "₹" },
       { "id": "targetRate", "label": "Target Sell Rate", "type": "slider", "min": 1500, "max": 5000, "step": 50, "defaultValue": 2480, "unit": "₹" },
       { "id": "freightCost", "label": "Est. Freight / Qtl", "type": "slider", "min": 50, "max": 500, "step": 10, "defaultValue": 180, "unit": "₹" }
     ],
     "outputs": [
       { "label": "Gross Arbitrage Spread", "formula": "targetRate - sourceRate", "format": "currency" },
       { "label": "Net Realized Profit", "formula": "targetRate - sourceRate - freightCost", "format": "currency", "highlight": true }
     ]
   }
   \`\`\`

4. EXECUTIVE KPI HIGHLIGHT BADGES (USE \`\`\`cards - STRICTLY ONLY WHEN RELEVANT):
   - CRITICAL RULE: \`\`\`cards must ONLY be used when presenting an executive multi-metric summary (e.g. comprehensive market overviews or multi-mandi arbitrage comparisons).
   - STRICT PROHIBITION: NEVER use \`\`\`cards for single-shop lookups (e.g., "Where is Photo Point?"), simple factual Q&A, or follow-up conversations. Answer those directly in clean, conversational markdown!
   Example (ONLY for multi-metric executive summaries):
   \`\`\`cards
   {
     "title": "Mandi Rate & Arbitrage Highlights",
     "cards": [
       { "label": "Top Realization Yard", "value": "₹2,480/qtl", "status": "positive", "subtext": "Indore APMC" },
       { "label": "Max Net Gain", "value": "+₹450/qtl", "status": "positive", "subtext": "After freight deduction" },
       { "label": "Market Trend", "value": "Bullish", "status": "neutral", "subtext": "Arrivals down 12%" }
     ]
   }
   \`\`\`

5. LOCAL COMPETITOR & OUTLET COORDINATES (USE \`\`\`map):
   When scanning specific geographical locations or competitor clusters, emit a Leaflet map spec with coordinates.

6. STRUCTURED COMPARISONS & INVENTORIES:
   Use standard GitHub-Flavored Markdown tables (| Col 1 | Col 2 |). DO NOT force tables on single-entity answers.`;

    const rawFilteredHistory = history
      .filter((h: any) => h.role === "user" || h.role === "assistant")
      .map((h: any) => ({
        role: h.role as "user" | "assistant",
        content: typeof h.content === "string" ? h.content : JSON.stringify(h.content),
      }));

    const formattedMessages = rawFilteredHistory.slice(-8);
    formattedMessages.push({
      role: "user",
      content: textContent || "Analyze the attached file.",
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch (e) {}
        };

        emitToolDelta = (d) => sendEvent("tool_result_delta", d);

        sendEvent("conversation_init", {
          conversationId: activeConversationId,
          title: conversationTitle,
        });

        let accumulatedText = "";
        const toolInvocations: any[] = [];
        const streamStartTime = Date.now();

        try {
          const aiStream = streamText({
            model,
            system: systemInstruction,
            messages: formattedMessages,
            tools: tools as any,
            stopWhen: isStepCount(6),
            providerOptions: {
              vertex: {
                streamFunctionCallArguments: true,
              },
            },
          });

          const toolNameById = new Map<string, string>();

          for await (const rawPart of (aiStream as any).fullStream) {
            const part = rawPart as any;
            if (part.type === "text-delta" || part.type === "text") {
              const textChunk = part.textDelta ?? part.text ?? "";
              if (textChunk) {
                accumulatedText += textChunk;
                sendEvent("chunk", { text: textChunk });
              }
            } else if (
              part.type === "reasoning-delta" ||
              part.type === "reasoning"
            ) {
              const delta = part.textDelta || part.text || "";
              if (delta) {
                sendEvent("thinking", { text: delta });
              }
            } else if (part.type === "tool-input-start") {
              const callId = part.id || part.toolCallId || "stageDocument";
              toolNameById.set(callId, part.toolName);
              if (part.toolName === "stageDocument") {
                sendEvent("artifact_start", {
                  toolCallId: callId,
                  toolName: part.toolName,
                  title: "Market Intelligence Report",
                });
              }
            } else if (
              part.type === "tool-input-delta" ||
              part.type === "tool-call-delta"
            ) {
              // Real token-by-token streaming of tool call arguments directly from the LLM
              const callId = part.id || part.toolCallId || "stageDocument";
              const toolName =
                toolNameById.get(callId) ||
                part.toolName ||
                "stageDocument";
              const delta = part.delta ?? part.argsTextDelta ?? "";
              sendEvent("tool_call_delta", {
                toolCallId: callId,
                toolName,
                argsTextDelta: delta,
              });
            } else if (part.type === "tool-call") {
              const callId = part.id || part.toolCallId;
              const toolName =
                part.toolName ||
                toolNameById.get(callId) ||
                "unknown_tool";
              const toolArgs = part.input ?? part.args ?? {};
              const def = (TOOL_DEFINITIONS as any)[toolName] || {
                icon: "bot",
                formatSummary: (args: any) => `Executing ${toolName}...`,
              };
              const summary =
                typeof def.formatSummary === "function"
                  ? def.formatSummary(toolArgs)
                  : `Executing ${toolName}...`;

              sendEvent("tool_call", {
                toolName,
                toolCallId: callId,
                icon: def.icon || "bot",
                args: toolArgs,
                summary,
                status: "calling",
              });
            } else if (part.type === "tool-result") {
              const callId = part.id || part.toolCallId;
              const toolName =
                part.toolName ||
                toolNameById.get(callId) ||
                "unknown_tool";

              // Real generator streaming: preliminary delta emitted by async generator tools
              if (part.preliminary) {
                const delta = part.output?.delta || part.result?.delta || "";
                sendEvent("tool_result_delta", {
                  toolCallId: callId,
                  toolName,
                  delta,
                });
                continue;
              }

              const toolArgs = part.input ?? part.args ?? {};
              const toolResult = part.output ?? part.result ?? {};
              const def = (TOOL_DEFINITIONS as any)[toolName] || {
                icon: "bot",
                formatSummary: () => "Action completed",
              };
              const summary =
                (typeof def.formatSummary === "function"
                  ? def.formatSummary(toolArgs, toolResult)
                  : undefined) ||
                (typeof def.formatSummary === "function"
                  ? def.formatSummary(toolArgs)
                  : `Executed ${toolName}`);

              toolInvocations.push({
                toolName,
                icon: def.icon || "bot",
                args: toolArgs,
                result: toolResult,
                summary,
                status: "completed",
              });

              sendEvent("tool_result", {
                toolName,
                toolCallId: callId,
                icon: def.icon || "bot",
                result: toolResult,
                summary,
                status: "completed",
              });

              if (toolName === "updateBusinessContext" && toolResult?.profile) {
                sendEvent("profile_update", toolResult.profile);
              }
            }
          }
        } catch (err: any) {
          console.error("[Stream Controller Error]:", err);
          const errorMsg = `⚠️ An error occurred while processing your request: ${err?.message || "Execution error"}. Please retry.`;
          accumulatedText = errorMsg;
          sendEvent("chunk", { text: errorMsg });
        } finally {
          const thoughtDurationSeconds = Math.max(
            1,
            Math.round((Date.now() - streamStartTime) / 1000),
          );

          if (accumulatedText.trim()) {
            chatStore.addMessage({
              conversationId: activeConversationId,
              role: "assistant",
              content: accumulatedText.trim(),
              thinking: JSON.stringify({
                durationSeconds: thoughtDurationSeconds,
              }),
              toolCalls: toolInvocations.length > 0 ? toolInvocations : undefined,
            });
          }

          sendEvent("done", {
            conversationId: activeConversationId,
            text: accumulatedText,
            thoughtDurationSeconds,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("[POST /api/chat/stream error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
