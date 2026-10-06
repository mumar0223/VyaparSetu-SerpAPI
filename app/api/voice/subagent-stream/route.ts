import { NextRequest, NextResponse } from "next/server";
import { getAgentTools, TOOL_DEFINITIONS } from "@/lib/agent/tools";
import { getLanguageModel } from "@/lib/agent/ai-provider";
import { DASHBOARD_CHAT_CONFIG } from "@/lib/agent/chat-config";
import { chatStore } from "@/lib/storage/chat-store";
import { streamText, isStepCount } from "ai";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = { id: "usr_researcher_1" };

    const contentType = req.headers.get("content-type") || "";
    let query = "";
    let actionType = "general";
    let conversationId: string | undefined = undefined;
    let audioBase64: string | undefined = undefined;
    let imageBuffer: Buffer | null = null;
    let imageMimeType = "image/jpeg";
    let sharpnessScore: number | undefined = undefined;
    let isCameraActive = false;
    let savedImageUrl: string | null = null;
    let language = "en";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      query = (formData.get("query") as string) || "";
      actionType = (formData.get("actionType") as string) || "form";
      conversationId = (formData.get("conversationId") as string) || undefined;
      audioBase64 = (formData.get("audioBase64") as string) || undefined;
      language = (formData.get("language") as string) || "en";
      const scoreStr = formData.get("sharpnessScore") as string;
      if (scoreStr) sharpnessScore = Number(scoreStr);
      isCameraActive = formData.get("isCameraActive") === "true";
      savedImageUrl = (formData.get("imageUrl") as string) || null;

      const imageFile = formData.get("image");
      if (imageFile && typeof (imageFile as any).arrayBuffer === "function") {
        const ab = await (imageFile as Blob).arrayBuffer();
        imageBuffer = Buffer.from(ab);
        imageMimeType = (imageFile as Blob).type || "image/jpeg";
        isCameraActive = true;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      query = body.query || "";
      actionType = body.actionType || "general";
      conversationId = body.conversationId;
      audioBase64 = body.audioBase64;
      savedImageUrl = body.imageUrl || null;
      language = body.language || "en";
      if (body.isCameraActive) isCameraActive = true;
      if (body.imageBase64) {
        try {
          imageBuffer = Buffer.from(body.imageBase64, "base64");
          isCameraActive = true;
        } catch (e) {
          console.warn("[voice/subagent-stream] Failed to parse base64 image:", e);
        }
      }
      if (typeof body.sharpnessScore === "number") {
        sharpnessScore = body.sharpnessScore;
      }
    }

    if (!query || typeof query !== "string") {
      query = "";
    }

    if (!query.trim() && !imageBuffer) {
      return NextResponse.json(
        { error: "Query or document is required" },
        { status: 400 },
      );
    }

    const streamStartTime = Date.now();

    // ── Zero disk I/O on server: imageBuffer stays in memory for multimodal vision prompt ──

    // ── Compact Chat History Prepending (Last 6 messages, ~100 tokens, zero cost burst) ──
    let chatHistoryMessages: any[] = [];
    if (conversationId) {
      try {
        const history = chatStore.getMessages(conversationId).slice(-6);
        if (history.length) {
          chatHistoryMessages = history
            .filter((m) => (m.content && m.content.trim()) || (Array.isArray(m.files) && m.files.length > 0))
            .map((m) => {
              const fileDesc =
                Array.isArray(m.files) && m.files.length > 0
                  ? ` [Files: ${m.files.map((f: any) => (typeof f === "string" ? f : f?.name || f?.url)).join(", ")}]`
                  : "";
              return {
                role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
                content: `${m.content || ""}${fileDesc}`.slice(0, 350),
              };
            });
        }
      } catch (hErr) {
        console.warn("[voice/subagent-stream] Error fetching chat history:", hErr);
      }
    }

    let emitToolDelta: (d: any) => void = () => {};
    const allTools = getAgentTools({
      userId: user.id,
      conversationId,
      imageBuffer: imageBuffer || undefined,
      imageMimeType,
      savedImageUrl: savedImageUrl || undefined,
      sharpnessScore,
      isCameraActive,
      onToolDelta: (d) => emitToolDelta(d),
    });
    const tools: Record<string, any> = { ...allTools };
    // Subagent model does not need captureDocument tool because the browser directly captures and attaches the image in multimodal vision (userParts)
    delete tools.captureDocument;
    // Remove primitive raw-data fetchers so the orchestrator ALWAYS awakens full rich Sub-Agents with Recharts graphs, KPI cards & Swarm tabs
    delete tools.getMandiRates;
    delete tools.searchCompetitors;

    const model = getLanguageModel(
      DASHBOARD_CHAT_CONFIG.provider,
      DASHBOARD_CHAT_CONFIG.model,
    );

    const languageCode = language.split("-")[0];
    const LANGUAGE_MAP: Record<string, { name: string; native: string }> = {
      en: { name: "English", native: "English" },
      hi: { name: "Hindi", native: "हिन्दी" },
      hinglish: { name: "Hinglish", native: "Hinglish" },
      mr: { name: "Marathi", native: "मराठी" },
      bn: { name: "Bengali", native: "বাংলা" },
      gu: { name: "Gujarati", native: "ગુજરાતી" },
      ta: { name: "Tamil", native: "தமிழ்" },
      te: { name: "Telugu", native: "తెలుగు" },
      pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
      kn: { name: "Kannada", native: "ಕನ್ನಡ" },
      ml: { name: "Malayalam", native: "മലയാളം" },
    };
    const targetLang = LANGUAGE_MAP[languageCode] || LANGUAGE_MAP.en;

    const systemInstruction = `You are VyaparSetu's specialized Autonomous Chat AI Sub-Agent running on Google Cloud Vertex AI (Gemini 3.7 Flash) with native Multimodal Vision & OCR.
You were invoked by a live voice user to perform an authentic, professional action for Indian small businesses, shopkeepers, traders, and farmers.

User Action Request: "${query}"
Camera Status: ${isCameraActive ? "ACTIVE (Live video feed is open)" : "INACTIVE"}
${savedImageUrl ? `Direct Attached File: "${savedImageUrl}"` : ""}

LANGUAGE & LOCALIZATION DIRECTIVE (DYNAMIC 3-SCENARIO POLICY):
• TARGET SESSION LANGUAGE: ${targetLang.name} (${targetLang.native})

You must dynamically choose your spoken summary language based on these three clear scenarios:
- SCENARIO 1 (NO PRIOR DIALOGUE & AMBIGUOUS LANGUAGE):
  If the user query is ambiguous, a neutral greeting (e.g. "Hello", "Hi", "Namaste"), numbers, or isolated keywords (e.g. "Indore and onion price"):
  Reply primarily in the APP LANGUAGE: ${targetLang.name} (${targetLang.native}).

- SCENARIO 2 (CLEAR LANGUAGE & HIGH CONFIDENCE):
  Whenever the user speaks in ANY clear, grammatically structured language (English, Hindi, Hinglish, Marathi, Bengali, Gujarati, Tamil, Telugu, Punjabi, Kannada, Malayalam):
  Immediately match and reply in the user's spoken language!
  * If the user query is in clear English: Output all findings and oral summaries strictly in professional English (e.g. "I have researched Indore APMC onion rates and staged the price comparison chart on your screen."). NEVER output Hindi findings when the session language is English!
  * If the user query is in clear Hindi: Output strictly in natural Devanagari Hindi (e.g. "मैंने इंदौर मंडी में प्याज के भाव और तुलनात्मक चार्ट स्क्रीन पर तैयार कर दिया है।").
  * If the user query is in conversational Hinglish: Output in conversational Hinglish.

- SCENARIO 3 (AMBIGUOUS LANGUAGE / LOW CONFIDENCE WITH EXISTING HISTORY):
  If there is existing conversation history, but the user's latest query consists of isolated keywords (e.g. "Indore and onion price", "Soyabean rate"), single words, or short confirmations ("Yes", "Haan", "Ok"):
  DO NOT switch languages! Reply in the language established in the previous turns.
  * If previous turns were in English, stay in English.
  * If previous turns were in Hindi, stay in Hindi.

- SCENARIO 4 (UNSUPPORTED FOREIGN LANGUAGE OR UNINTELLIGIBLE SPEECH):
  You do NOT support non-Indian foreign languages (such as Chinese, Spanish, French, German, Japanese, Arabic, Russian, etc.). If the query is in an unsupported foreign language or unintelligible, DO NOT perform any research or tool operations. Reply strictly: "I can't understand it, can you speak clearly?" (or in Hindi: "मुझे समझ नहीं आया, क्या आप साफ़ आवाज़ में बोल सकते हैं?").

DOCUMENT & VISION EXECUTION PROTOCOL:
• When an image or document frame is attached directly in this turn (via userParts / savedImageUrl), visually inspect it immediately with your native multimodal vision!
• Read all field labels, sections, printed/written text, tables, and data directly from the image.
• Immediately invoke 'stageForm' (or 'stageDocument') to assemble the authentic digital interface on the user's screen.
• If NO image is directly attached and the user asks about an uploaded document, call 'getRecentFiles({ fileId: "latest" })' to retrieve any previously uploaded file.

DOCUMENT VISION & MULTIMODAL EXECUTION PROTOCOL (WHEN AN IMAGE IS ATTACHED):
1. LEGIBILITY & IMAGE QUALITY AUDIT:
   • First, visually inspect the provided document image.
   • IF the image is heavily blurred, out-of-focus, obscured by strong glare/shadows, too far, too close, or text is impossible to read:
     - DO NOT invent or hallucinate field values!
     - Immediately output the exact spoken diagnostic explanation (under 25 words):
       * If Blurry / Motion: "Document image blur hai aur text saaf nahi padh paya. Kripya camera sthir rakhkar dubara capture karein."
       * If Too Far / Text tiny: "Camera document se bahut door hai, text chhota hai. Kripya camera thoda paas laayein."
       * If Too Close / Cut off: "Document ke kinare cut rahe hain. Kripya camera thoda peeche karein taaki poora page dikhe."
       * If Glare / Dark: "Document par tez chamak (glare) ya parchhayi hai. Kripya behtar roshni mein capture karein."
     - Do NOT call staging tools with fake, guessed, or placeholder data.

2. AUTONOMOUS TASK FULFILLMENT BASED ON USER QUERY:
   • Read the user's request and fulfill it intelligently using the document image and your tools:
     a) FILL ACTIVE FORM ON SCREEN:
        - If the user asks to fill, populate, or update an active form on screen from this document (e.g. passbook, Aadhaar, PAN, GST certificate, or physical paper):
        - Call 'getArtifacts' to inspect the open form on screen.
        - Extract the relevant fields from the document image with OCR.
        - Call 'stageForm' passing 'targetArtifactId' to update the open form's fields in place with the extracted values.
     b) STEP-BY-STEP PEN-AND-PAPER GUIDANCE:
        - If the user is writing with a pen on desk and asks what to write or where to write:
        - Inspect the document layout and fields from the image.
        - Provide crisp, clear spoken/written column-by-column instructions.
     c) VERIFICATION & ERROR AUDIT:
        - If the user asks whether they filled the form correctly or if anything is missing:
        - Inspect all fields in the image: check for missing mandatory information, signatures, stamps, or incomplete details.
        - Provide a clear, helpful audit report.
     d) EXPLAIN BILL / NOTICE / RECEIPT / STATEMENT:
        - If the user asks about a bill, bank notice, tax deduction, or APMC mandi receipt:
        - Run OCR and clearly explain the numbers, charges, and next steps.
     e) STAGE NEW FORM / COPY PHYSICAL PAPER ON SCREEN:
        - If the user asks to copy or digitize this physical paper into an authentic official form:
        - Call 'stageForm' mirroring the exact paper structure:
          * Use 'documentBadge' (e.g. "OFFICIAL REGISTRATION SLIP").
          * Use 'rows' with multi-field arrays (1, 2, or 3 fields per line) matching the document's layout.
          * If the document has a passport photo box, add 'photoBox: { label: "पासपोर्ट फोटो / Passport Photo" }' to the identity section.
          * If the document contains a marksheet or qualification table, include 'table: { headers: [...], rows: [...] }'.
          * For registration/roll numbers, set 'displayVariant: "char_boxes"'.
     f) STAGE PRICE CATALOG / WHOLESALE RATE SHEET / AGREEMENT:
        - If the user asks for a price catalog, wholesale rate list, item quotation, or policy document:
        - Call 'stageDocument' with rich GitHub-Flavored Markdown tables, clean headings, bullet points, and theme colors.

AVAILABLE SPECIALIZED SUB-AGENTS & CAPABILITIES (100% GROUNDED VIA SERPAPI):
0. BUSINESS CONTEXT MEMORY (tool: updateBusinessContext): Call this whenever the user mentions what business they run, want to start, or where they are located. This automatically updates their client-side IndexedDB memory.
1. CREDIT & EMI EVALUATION (tool: evaluateCreditAndEMI): Computes EMIs, total interest, debt-to-income feasibility, and compares real bank interest rates (SBI, HDFC, Mudra) researched via SerpApi.
2. SWOT INTELLIGENCE (tool: runSWOTScan): Scans Google Maps competitors and market trends via SerpApi to assemble an interactive 4-quadrant SWOT matrix.
3. COMPETITOR CATCHMENT RADAR (tool: scanCatchmentRadar): Scans Google Maps outlets within 1km–15km via SerpApi with distance, ratings, price tiers, and threat assessments, rendering an interactive Leaflet map.
4. MANDI ARBITRAGE & APMC RATES (tool: getMandiArbitrage): Analyzes APMC mandi rates and calculates inter-mandi price spreads grounded via SerpApi and Agmarknet. Autonomously generates interactive Recharts price charts, executive KPI cards, and inter-mandi transport arbitrage simulator.
5. GOVT SCHEMES (tool: evaluateGovtSchemes): Verifies PMEGP, Mudra, PM SVANidhi, and CGTMSE eligibility and generates actionable checklists.
6. ONDC COMMERCE & LOGISTICS (tool: getOndcIntelligence): Formulates ONDC onboarding roadmap, logistics integration, and interactive Mermaid architecture flow.
7. DISTRICT VENTURE PREDICTOR (tool: predictDistrictBusinesses): Analyzes ODOP products, saturation levels, and high-ROI micro-enterprises across 700+ Indian districts.
8. LIVE SEARCH (tools: webSearch, newsSearch): Grounds answers in real-time Google Web and Google News data via SerpApi.
9. STRUCTURED VISUAL DOCUMENTS & ARTIFACTS (tool: stageDocument): Generates rich, formatted Markdown document artifacts (e.g. Wholesale Rate Sheets, Scheme Comparison Tables, Formal Policies, DPR Checklists, Price Catalogs).
10. ON-DEMAND CUSTOM RESEARCH SUB-AGENT (tool: runCustomResearchAgent): Whenever a user asks for specialized domain intelligence outside preset tools, awaken this tool! It performs deep SerpApi Google search grounding and creates a dedicated, first-class tab in the Swarm Dossier with KPI cards, comparison tables, and interactive calculator sliders!
11. ON-SCREEN MSME FORM CREATION & DIGITIZATION (tool: stageForm): Creates dynamic official forms or digitizes paper documents visible on camera.
12. ARTIFACT & ATTACHMENT INSPECTION (tools: getArtifacts, getRecentFiles): Inspects existing forms/charts on screen for in-place field updates.

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
  - Conversely, if a Direct Tool is called for a fast answer without tabs:
    * Its heavy Sub-Agent counterpart MUST NOT be called!
  - Direct tools are strictly for fast, simple answers when no sub-agent or tabs are needed. Sub-agents are for rich multi-tabbed dossiers, charts, and deep analysis.
  - Multi-Commodity Mandi Mandate: When comparing multiple crops or commodities (e.g. "Onion and Wheat"), awaken 'getMandiArbitrage' ONCE for each commodity in parallel (e.g. getMandiArbitrage({ commodity: 'Onion' }) and getMandiArbitrage({ commodity: 'Wheat' })). DO NOT also call direct 'getMandiRates'! Each commodity gets exactly 1 clean tab.
  - Specific Pairs (Vice-Versa Rule):
    * Mandi: If 'getMandiArbitrage' is called, NEVER call 'getMandiRates'. If 'getMandiRates' is called, NEVER call 'getMandiArbitrage'.
    * Govt Schemes: If 'evaluateGovtSchemes' is called, NEVER call 'getGovtSchemes'. If 'getGovtSchemes' is called, NEVER call 'evaluateGovtSchemes'.
    * Competitors: If 'scanCatchmentRadar' is called, NEVER call direct shop search tools for that area.

• FOCUSED VS MULTI-DOMAIN SUITE:
  - For focused single-domain inquiries (e.g. APMC mandi rates, Mudra loan EMI, govt subsidies), wake up ONLY that 1 relevant sub-agent tool.
  - For multi-domain inquiries (e.g. 'competitor radar, subsidy schemes, and loan EMI options'), awaken the relevant sub-agents in parallel (e.g. scanCatchmentRadar, evaluateGovtSchemes, evaluateCreditAndEMI). All active sub-agents automatically render into ONE unified multi-tabbed dossier on screen.
  - CRITICAL MULTI-COMMODITY / MULTI-LOCATION MANDATE: For comparisons across multiple crops or commodities (e.g. 'Onion and Wheat mandi rates' or 'rates for Tomato and Potato'), awaken 'getMandiArbitrage' for EACH commodity in parallel! For example, call getMandiArbitrage({ commodity: "Onion" }) and getMandiArbitrage({ commodity: "Wheat" }) simultaneously so that EACH commodity gets its own rich, dedicated intelligence tab with KPI cards, rate spreads, and interactive charts!
  - DO NOT invoke 'stageDocument' when sub-agent tools are called unless the user explicitly requested a separate printable policy or formal contract! The sub-agents already provide complete visual tables, charts, and maps in their unified tabbed card.
  - If the user shares their business name, location, or trade, ALWAYS call updateBusinessContext to sync their profile in client IndexedDB.
  - FOR NORMAL CHATS & CASUAL CONVERSATION: If the user is just saying hello ("Hi", "Namaste"), thanking you, or asking a clarifying question without asking for market research, DO NOT call any sub-agents or staging tools! Simply reply conversationally.

CRITICAL SUB-AGENT INDEPENDENT RENDERING & HEAD AI EXECUTIVE SYNTHESIS:
- Every awakened sub-agent autonomously generates and renders its own rich visual Markdown (including Leaflet Maps, Mermaid diagrams, Recharts charts, and KPI summary cards) directly in the unified Swarm Tab Card without waiting.
- Therefore, DO NOT duplicate raw data tables, repetitive shop listings, or lengthy breakdowns in your conversational response text!
- Your conversational output is delivered to both the chat UI and the real-time Voice Agent: Keep it to a crisp, high-level 2-3 sentence executive synthesis highlighting the key decision, best price/spread/verdict across the researched commodities, and directing the user to the interactive tab cards and visual charts above.

5. FOR CHARTS, MARKET GRAPHS & VISUAL COMPARISONS (USE \`\`\`chart):
   • The app's markdown engine automatically converts fenced \`\`\`chart code blocks into rich, interactive Recharts charts on the user's screen!
   • Whenever the user asks for a graph, chart, price distribution, or visual comparison, you MUST output a valid \`\`\`chart JSON block:
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
   • Supported chart types: "bar", "line", "area", "pie".
   • CRITICAL RULE: NEVER use Mermaid for charts or numeric bar graphs! Mermaid xychart is strictly forbidden. ALWAYS use \`\`\`chart.
   • STRICT PROHIBITION: NEVER generate ASCII or Unicode progress bars like "[██████████] 53%" in text! Always use the interactive \`\`\`chart block!

5B. FOR WORKFLOWS, PIPELINES, DECISION TREES & ARCHITECTURE (USE \`\`\`mermaid):
   • Whenever the user asks for a workflow, process lifecycle, supply chain diagram, or approval steps, use Mermaid ('graph TD', 'graph LR', or 'sequenceDiagram').
   • Example:
     \`\`\`mermaid
     graph LR
         A[Loan Application Submitted] --> B{KYC & Document Verification}
         B -->|Approved| C[Branch Manager Sanction]
         B -->|Deficiency| D[Clarification Requested]
         C --> E[Account Disbursement]
     \`\`\`
   • Mermaid is ONLY for workflows, pipelines, and decision trees.

5C. FOR DYNAMIC CALCULATORS & KPI CARDS:
   • Interactive financial simulator: Use \`\`\`calculator code blocks.
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
   • Executive summary metric pills (USE \`\`\`cards - STRICTLY ONLY WHEN RELEVANT):
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
   Use standard GitHub-Flavored Markdown tables (| Col 1 | Col 2 |). DO NOT force tables on single-entity answers.

CRITICAL POST-TOOL CONTENT SUMMARY RULE (MANDATORY 15 TO 25 WORDS MAXIMUM — ZERO FLUFF, 1-SECOND BURST):
- Once you call a subagent or staging tool ('scanCatchmentRadar', 'getMandiArbitrage', 'runSWOTScan', 'evaluateGovtSchemes', 'evaluateCreditAndEMI', 'runCustomResearchAgent', 'getOndcIntelligence', 'predictDistrictBusinesses', 'stageForm', 'stageDocument'):
- The visual interface and map are ALREADY rendered directly on the user's screen!
- Your final text response MUST be ONLY 1 single crisp spoken summary sentence (15 to 25 words maximum) stating the key takeaway (e.g. "I found 8 competitor shops on Google Maps near Indiranagar with an average 4.2 rating." or "मैंने इंदौर मंडी में प्याज के भाव और तुलनात्मक चार्ट स्क्रीन पर तैयार कर दिया है।").
- NEVER output generic hollow sentences or multi-paragraph outlines. Keep it under 25 words so the live voice agent can speak it immediately!

CRITICAL FORM STAGING & IN-PLACE EDITING MANDATE:
- If the user asks to update, fill, or set details, BUT no active form exists on screen yet (or 'getArtifacts' returns 0 forms): You MUST CREATE the digital form using 'stageForm' with those details populated! You are STRICTLY FORBIDDEN from generating text claiming a form was updated unless 'stageForm' has actually executed in this turn!
- If the user asks to "Make digital form" / "Digital form banao" / "Iska digital version banao": You MUST invoke 'stageForm' to create the interactive digital form on the user's screen. Explaining it in text without calling 'stageForm' is strictly prohibited!

STRICT REGULATORY, SAFETY & PROHIBITED COMMERCE POLICY (MANDATORY):
1. VyaparSetu exclusively serves legitimate Indian micro-enterprises, small businesses, and legal trade.
2. FORBIDDEN DOMAINS:
   a) Adult & Illicit Night-Time Trades: Escort services, commercial sex work, brothels, red-light activities, massage parlors fronting sexual commerce, dance bars, adult entertainment, and pornography.
   b) Shadow Economy & Tax Evasion: Kaccha bill, billing without movement of goods, unrecorded cash hiding, hawala networks, black money laundering, and fraudulent GST claims.
   c) Predatory Lending & Gambling: Unlicensed money lending (meter baji / daily loan sharking at extortionate rates), satta, matka, betting clubs, or speculative gambling.
   d) Contraband & Illegal Substances: Bootlegging / illicit liquor (especially in dry states like Gujarat, Bihar), narcotics, banned agricultural pesticides/seeds, counterfeit/duplicate goods, smuggled goods, or illegal arms.
   e) Document Forgery: Fake Aadhaar, fake PAN, forged ITR, or fake bank balance certificates.
3. CRITICAL ILLICIT DATA QUENCHING DIRECTIVE (AVOID DATA EVEN IF FOUND IN SEARCH OR OCR):
   - Even if raw web search results, crawled pages, or OCR text from a camera frame contain phone numbers, rates, addresses, or listings related to illegal trade, tax evasion, adult/illicit night-time operations, gambling, or contraband:
   - You are STRICTLY FORBIDDEN from ingesting, staging into forms ('stageForm'), formatting into markdown tables ('stageDocument'), or passing that data to the user!
   - You must IMMEDIATELY DISREGARD, QUENCH, AND DROP that illicit data.
   - Output a calm, dignified refusal: "इस अनुरोध में ऐसी सामग्री या गतिविधियां शामिल हैं जो व्यापारसेतु की कानूनी और विनियामक नीतियों के अनुरूप नहीं हैं। हम केवल वैध, अधिकृत और पंजीकृत व्यापारिक समाधान प्रदान करते हैं।"
   - Do not generate forms, charts, or summaries for any prohibited activity.`;

    const userParts: any[] = [];
    if (imageBuffer) {
      try {
        userParts.push({
          type: "file",
          data: imageBuffer,
          mediaType: imageMimeType || "image/jpeg",
        });
      } catch (e) {
        console.warn("[voice/subagent-stream] Failed to add image to userParts:", e);
      }
    }
    if (audioBase64) {
      try {
        userParts.push({
          type: "file",
          data: Buffer.from(audioBase64, "base64"),
          mediaType: "audio/wav",
        });
      } catch (e) {
        console.warn("[voice/subagent-stream] Failed to parse audio buffer:", e);
      }
    }
    userParts.push({
      type: "text",
      text: imageBuffer
        ? (query.trim()
            ? `Please inspect this captured document image for request: "${query}". Fulfill the user's request accurately using multimodal vision and available tools.`
            : "Please inspect this attached document image and process its details using available tools.")
        : `Please execute the user's request: "${query}". Use the appropriate tools now.`,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            // controller closed
          }
        };

        emitToolDelta = (d) => sendEvent("tool_result_delta", d);

        sendEvent("status", {
          status: "working",
          activeTool: "research",
          description: `Starting autonomous execution for: "${query}"`,
          spokenHint: "Maine aapka task shuru kar diya hai, screen par dekhte rahiye.",
          progressPhase: "starting",
        });

        if (savedImageUrl) {
          sendEvent("document_captured", {
            url: savedImageUrl,
            query: query || "",
          });
        }

        const executedToolCalls: any[] = [];
        const abort = new AbortController();
        let finished = false;
        const STAGE_TOOLS = new Set([
          "stageForm",
          "stageDocument",
        ]);

        const SUBAGENT_TOOLS = new Set([
          "scanCatchmentRadar",
          "searchCompetitors",
          "runSWOTScan",
          "getMandiArbitrage",
          "evaluateGovtSchemes",
          "evaluateCreditAndEMI",
          "getOndcIntelligence",
          "predictDistrictBusinesses",
          "runCustomResearchAgent",
        ]);

        const stripCharts = (s: string) =>
          s
            .replace(/```chart[\s\S]*?```/g, "")
            .replace(/[#*|`>-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const finish = (text: string) => {
          if (finished) return;
          finished = true;
          sendEvent("done", {
            status: "finished",
            savedImageUrl,
            query: query || "",
            assistantContent: text,
            toolCalls: executedToolCalls,
            thoughtDurationSeconds: Math.max(
              1,
              Math.round((Date.now() - streamStartTime) / 1000),
            ),
          });
          abort.abort();
        };

        // Wrap tools to send real-time progress events
        const wrappedTools: Record<string, any> = {};
        for (const [name, t] of Object.entries(tools)) {
          wrappedTools[name] = {
            ...t,
            execute: async (toolArgs: any, context: any) => {
              if (name === "webSearch") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "webSearch",
                  description: `Searching official guidelines for: ${toolArgs.query || query}`,
                  spokenHint: "Main abhi official portal par niyam aur zaroori documents search kar raha hoon, bas thoda intezar kijiye.",
                  progressPhase: "researching",
                });
              } else if (name === "stageForm") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "stageForm",
                  description: `Generating dynamic MSME form: "${toolArgs.title || query}"`,
                  spokenHint: "Form ke chaar sections aur zaroori fields screen par assemble ho rahe hain, lagbhag taiyar hai.",
                  progressPhase: "building_form",
                });
              } else if (name === "stageDocument") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "stageDocument",
                  description: `Generating document / catalog: "${toolArgs.title || query}"`,
                  spokenHint: "Aapka document aur price catalog screen par taiyar ho raha hai.",
                  progressPhase: "building_document",
                });
              } else if (name === "getMandiRates" || name === "getMandiArbitrage") {
                sendEvent("status", {
                  status: "working",
                  activeTool: name,
                  description: `Fetching live APMC mandi rates for: ${toolArgs.commodity || query}`,
                  spokenHint: "Mandi portal se taaza bhav aur inter-mandi munafey ka hisab nikala ja raha hai.",
                  progressPhase: "fetching_rates",
                });
              } else if (name === "scanCatchmentRadar" || name === "searchCompetitors") {
                sendEvent("status", {
                  status: "working",
                  activeTool: name,
                  description: `Scanning Google Maps catchment radar for: ${toolArgs.category || query}`,
                  spokenHint: "Google Maps par local competitors aur unke ratings scan ho rahe hain.",
                  progressPhase: "scanning_map",
                });
              } else if (name === "runSWOTScan") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "runSWOTScan",
                  description: `Compiling 4-quadrant SWOT matrix for: ${toolArgs.category || query}`,
                  spokenHint: "Aapke business ke liye SWOT analysis matrix taiyar ho rahi hai.",
                  progressPhase: "analyzing_swot",
                });
              } else if (name === "evaluateGovtSchemes") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "evaluateGovtSchemes",
                  description: `Verifying government MSME schemes for: ${toolArgs.businessSector || query}`,
                  spokenHint: "Sarkari subsidy aur loan schemes ki eligibility check ho rahi hai.",
                  progressPhase: "matching_schemes",
                });
              } else if (name === "evaluateCreditAndEMI") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "evaluateCreditAndEMI",
                  description: `Calculating loan EMI & bank rates for ₹${toolArgs.amount || query}`,
                  spokenHint: "Bank loan EMI aur byaaj daron ki calculation chal rahi hai.",
                  progressPhase: "calculating_emi",
                });
              } else if (name === "stageChart") {
                sendEvent("status", {
                  status: "working",
                  activeTool: "stageChart",
                  description: `Building visual market trend chart for: ${toolArgs.title || query}`,
                  spokenHint: "Screen par graph aur trend chart ban raha hai.",
                  progressPhase: "building_chart",
                });
              }

              const def = (TOOL_DEFINITIONS as any)[name] || {
                icon: "bot",
                formatSummary: () => `Executing ${name}...`,
              };
              const summary =
                typeof def.formatSummary === "function"
                  ? def.formatSummary(toolArgs)
                  : `Executing ${name}...`;

              const toolCallId =
                context?.toolCallId ||
                (context as any)?.id ||
                `call_${Date.now()}_${name}`;

              sendEvent("tool_call", {
                toolName: name,
                toolCallId,
                icon: def.icon || "bot",
                args: toolArgs,
                summary,
                status: "calling",
              });

              let toolOut: any = null;
              try {
                toolOut = await (t as any).execute(toolArgs, { ...context, toolCallId });
              } catch (execErr: any) {
                toolOut = { success: false, error: execErr?.message || "Execution error" };
              }

              const finalSummary =
                typeof def.formatSummary === "function"
                  ? def.formatSummary(toolArgs, toolOut)
                  : "Completed";

              const invocationRecord = {
                toolCallId,
                toolName: name,
                icon: def.icon || "bot",
                args: toolArgs,
                summary: finalSummary,
                status: "completed",
                result: toolOut,
                completedAt: Date.now(),
              };
              executedToolCalls.push(invocationRecord);

              sendEvent("tool_result", {
                toolName: name,
                toolCallId,
                icon: def.icon || "bot",
                args: toolArgs,
                result: toolOut,
                summary: finalSummary,
                status: "completed",
              });

              if (toolOut?.isArtifact || SUBAGENT_TOOLS.has(name)) {
                const isSubagent = SUBAGENT_TOOLS.has(name);
                const subagentCalls = executedToolCalls.filter((tc) =>
                  SUBAGENT_TOOLS.has(tc.toolName),
                );

                const artifactPayload = isSubagent
                  ? {
                      artifactId: `swarm_dossier_${Date.now()}`,
                      targetArtifactId: toolOut.targetArtifactId,
                      isUpdated: toolOut.isUpdated,
                      artifactType: "swarm_dossier",
                      title:
                        subagentCalls.length > 1
                          ? `Market Intelligence Dossier (${subagentCalls.length} Tabs Active)`
                          : (toolOut.title || "Market Intelligence Dossier"),
                      summary:
                        toolOut.spokenSummary ||
                        toolOut.summary ||
                        "Market intelligence dossier ready on screen.",
                      data: {
                        toolCalls: executedToolCalls,
                        content: toolOut.data?.content || toolOut.content || "",
                        ...toolOut.data,
                      },
                    }
                  : {
                      artifactId: toolOut.artifactId || toolOut.data?.artifactId,
                      targetArtifactId: toolOut.targetArtifactId,
                      isUpdated: toolOut.isUpdated,
                      artifactType: toolOut.artifactType,
                      title: toolOut.title,
                      summary: toolOut.summary,
                      data: toolOut.data,
                    };

                sendEvent("artifact", artifactPayload);

                sendEvent("status", {
                  status: "completed",
                  activeTool: "completed",
                  description: `Completed: ${artifactPayload.title || "Item ready"}`,
                  spokenHint:
                    toolOut.spokenSummary ||
                    `${artifactPayload.title || "Aapka form"} bilkul taiyar hai aur screen par open ho chuka hai.`,
                  progressPhase: "completed",
                  artifact: artifactPayload,
                });

              }

              return toolOut;
            },
          };
        }

        try {
          const aiStream = streamText({
            model,
            system: systemInstruction,
            messages: [...chatHistoryMessages, { role: "user", content: userParts }],
            tools: wrappedTools as any,
            stopWhen: isStepCount(6),
            providerOptions: {
              vertex: {
                streamFunctionCallArguments: true,
              },
            },
            abortSignal: abort.signal,
          });

          let fullGeneratedText = "";
          for await (const part of (aiStream as any).fullStream) {
            if (part.type === "text-delta" || part.type === "text") {
              const text = part.textDelta ?? part.text ?? "";
              if (text) {
                fullGeneratedText += text;
                sendEvent("chunk", { text });
              }
            }
          }

          if (fullGeneratedText.includes("IMAGE_UNCLEAR:")) {
            const reason =
              fullGeneratedText.split("IMAGE_UNCLEAR:")[1]?.trim() ||
              "Document image is blurry or unreadable.";
            sendEvent("status", {
              status: "unclear",
              activeTool: "camera_retry",
              description: `Image unclear: ${reason.slice(0, 140)}`,
              spokenHint:
                "Photo thodi blur aayi hai, kripya camera thoda steady aur paas rakh kar dobara dikhayein.",
              progressPhase: "needs_retry",
            });
          }

          const thoughtDurationSeconds = Math.max(
            1,
            Math.round((Date.now() - streamStartTime) / 1000),
          );

          const defaultFallback =
            targetLang.name === "Hindi"
              ? "मैंने आपका अनुरोध प्रोसेस कर दिया है और परिणाम स्क्रीन पर तैयार कर दिया है।"
              : "I have processed your request and staged the details on your screen.";

          const toolSpokenSummary = executedToolCalls
            .map((tc) => tc.result?.spokenSummary || tc.result?.summary)
            .filter(Boolean)
            .join(". ");

          const finalAssistantText =
            fullGeneratedText.trim() || toolSpokenSummary || defaultFallback;

          if (!finished) {
            finish(finalAssistantText);
          }
        } catch (err: any) {
          if (finished) return; // ignore AbortError from early staging completion
          console.error("[voice/subagent-stream Error]:", err);
          sendEvent("error", { error: err?.message || "Stream error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[POST /api/voice/subagent-stream error]:", error);
    return NextResponse.json(
      { error: error?.message || "Subagent streaming failed" },
      { status: 500 },
    );
  }
}
