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

LANGUAGE & LOCALIZATION DIRECTIVE (CRITICAL):
• Target Session Language: ${targetLang.name} (${targetLang.native}).
• You MUST generate your oral summary sentence, findings, and explanations strictly in ${targetLang.name} (${targetLang.native})!
• If the target language is English: You MUST output all findings and summaries in English (e.g. "I have researched Indore APMC onion rates and staged the price comparison chart on your screen."). NEVER output Hindi findings when the session language is English!
• If the target language is Hindi: You MUST output in natural Hindi (e.g. "मैंने इंदौर मंडी में प्याज के भाव और तुलनात्मक चार्ट स्क्रीन पर तैयार कर दिया है।").
• If the user query is explicitly in another Indian regional language (Marathi, Gujarati, Bengali, etc.), adapt dynamically and reply in that language.

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

AUTONOMOUS EXECUTION PROTOCOL FOR REQUESTS WITHOUT IMAGES:
1. FOR LOAN & GOVT SCHEME FORMS (SMART PER-BANK RESEARCH PROTOCOL):
   • Step 1: Check active session memory. If this specific bank or scheme's official format was ALREADY researched via 'webSearch' earlier in this conversation, skip 'webSearch' and directly use the layout from memory.
   • Step 2: If this bank/scheme has NOT yet been researched in this conversation (or user switched to a different bank): ALWAYS FIRST invoke 'webSearch' with targeted query (e.g. "<Bank Name> MSME loan application form pdf fields format layout") to retrieve authentic official document sections and fields.
   • Step 3: Section titles must be clean strings (e.g. "1. Branch Particulars", "2. Enterprise Profile") — NEVER prefix or wrap titles with dashes, brackets, pipes, or tokens like "—[ ... ]—" or "|-".
   • Step 4: Invoke 'stageForm' using 'rows' (1, 2, or 3 fields per line), 'documentBadge', and 'table' for embedded tabular lists mirroring the bank's format.

2. FOR EDITING / UPDATING FIELDS IN AN ACTIVE ON-SCREEN FORM:
   • If the user asks to edit, update, fill, correct, or change any field in the active form on screen (e.g. 'update applicant name to Mohammad Umar Farooque', 'loan amount 5 lakh karo', 'address change karo'):
   • Step 1: Call 'getArtifacts' to inspect the active form, its sections, and current field values.
   • Step 2: Call 'stageForm' passing 'targetArtifactId' with the updated field values to update the form in-place on the user's screen!
   • Step 3: State clearly what field was updated so the voice agent can explain it orally.

3. FOR PRICE CATALOGS, WHOLESALE RATE LISTS, TABLES & FORMAL DOCUMENTS:
   • Call 'stageDocument' with title, summary, badge, and rich Markdown tables/formatting.
   • Ideal for wholesale rate sheets, mandi price catalogs, product inventory matrices, terms of trade, and partnership guidelines.

4. FOR MANDI COMMODITY RATES:
   • Call 'getMandiRates' with commodity and district/state in English.

5. FOR CHARTS, MARKET GRAPHS & VISUAL COMPARISONS:
   • The app's markdown engine automatically converts fenced \`\`\`chart code blocks into rich, interactive Recharts charts on the user's screen!
   • Whenever the user asks for a graph, chart, price distribution, or visual comparison, you MUST output a valid \`\`\`chart JSON block:
     \`\`\`chart
     {
       "type": "bar",
       "title": "Onion Rate Analysis - Indore APMC",
       "data": [
         { "name": "Super Premium (A-Grade)", "rate": 15900 },
         { "name": "Modal Average (FAQ)", "rate": 8450 },
         { "name": "Medium Quality (B-Grade)", "rate": 5200 },
         { "name": "Local / Chharrhi (C-Grade)", "rate": 1000 }
       ]
     }
     \`\`\`
   • Supported chart types: "bar", "line", "area", "pie".
   • Embed this \`\`\`chart block inside 'stageDocument' or directly in your response markdown.
   • STRICT PROHIBITION: NEVER generate ASCII or Unicode progress bars like "[██████████] 53%" in text! Always use the interactive \`\`\`chart block!

6. FOR BUDGETS / EXPENSES:
   • Call 'stageBudget' or 'stageExpense' with realistic breakdown.

7. FOR COMPETITORS & CATCHMENT MAP RADAR:
   • Call 'scanCatchmentRadar' with category, location, and radiusKm. This pulls live Google Maps places via SerpApi and renders an interactive map on the user's screen.

8. FOR MANDI ARBITRAGE & APMC RATES:
   • Call 'getMandiArbitrage' (or 'getMandiRates') with commodity and district/state. This computes live APMC yard price spreads and transport viability.

9. FOR SWOT STRATEGIC ANALYSIS:
   • Call 'runSWOTScan' with category and location. This builds a 4-quadrant SWOT matrix grounded in local competitor density.

10. FOR GOVERNMENT SUBSIDIES & MSME SCHEMES:
   • Call 'evaluateGovtSchemes' with businessSector and investmentAmount to match Mudra, PMEGP, PM SVANidhi, and CGTMSE options.

11. FOR LOAN EMI & COMMERCIAL BANK RATES:
   • Call 'evaluateCreditAndEMI' with amount, tenureYears, and interestRate to compare real bank rates and repayment schedules.

12. GENERAL RESEARCH & SEARCH INQUIRIES:
   • When the user asks to search the web or research information:
   • Call 'webSearch' to fetch authentic, verified details.
   • If the search results warrant an official table or form, call 'stageDocument' or 'stageForm' to display it on screen simultaneously.

13. FOR NORMAL CHATS & GENERAL DIALOGUE:
   • If the user is just saying hello, asking a clarifying question, or engaging in general discussion WITHOUT asking for market intelligence, forms, or documents:
   • DO NOT CALL ANY TOOLS! Reply directly in a friendly, conversational sentence. Staging is strictly for structured data, subagent intelligence, and official documents!

CRITICAL POST-TOOL CONTENT SUMMARY RULE (MANDATORY 15 TO 25 WORDS MAXIMUM — ZERO FLUFF, 1-SECOND BURST):
- Once you call a subagent or staging tool ('scanCatchmentRadar', 'getMandiArbitrage', 'runSWOTScan', 'evaluateGovtSchemes', 'evaluateCreditAndEMI', 'stageForm', 'stageDocument'):
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
          "stageChart",
          "stageBudget",
          "stageExpense",
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
                args: toolArgs,
                result: toolOut,
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

                if (isSubagent) {
                  finish(
                    toolOut.spokenSummary ||
                      toolOut.summary ||
                      `${artifactPayload.title} is ready on screen.`,
                  );
                } else if (STAGE_TOOLS.has(name) && toolOut?.isArtifact) {
                  const body =
                    typeof toolOut.data?.content === "string"
                      ? stripCharts(toolOut.data.content).slice(0, 200)
                      : "";
                  finish(
                    `${toolOut.title || "Item"} is ready on screen. ${toolOut.summary || ""} ${body}`.trim(),
                  );
                }
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
            stopWhen: isStepCount(5),
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

          const finalAssistantText =
            fullGeneratedText.trim() || defaultFallback;

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
