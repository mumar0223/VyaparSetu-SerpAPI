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

    // 3. Prepare AI execution and tools
    const tools = getAgentTools({
      conversationId: activeConversationId,
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

LANGUAGE DIRECTIVE:
1. APP ANCHOR: The user currently has ${targetLang.name} (${targetLang.native}) selected in their app settings.
   - For neutral greetings (e.g. "Hello", "Hi", "Namaste"), numbers, or ambiguous single-word prompts without prior dialogue, reply in ${targetLang.name} (${targetLang.native}).
2. DYNAMIC USER LANGUAGE ADAPTATION (CRITICAL):
   - Whenever the user writes in ANY specific language (English, Hindi, Hinglish, Marathi, Bengali, Gujarati, Tamil, Telugu, Punjabi, Kannada, Malayalam):
     IMMEDIATELY PRIORITIZE and reply in the user's written language and dialect!
   - If the user query is in English: Reply strictly in clear, professional English.
   - If the user query is in Hindi: Reply strictly in natural Devanagari Hindi.
   - If the user query is in Hinglish or Roman Hindi: Reply in conversational Hinglish.
   - Mirror the user's language choice consistently across subsequent turns.

AVAILABLE SPECIALIZED SUB-AGENTS & CAPABILITIES:
0. BUSINESS CONTEXT MEMORY (tool: updateBusinessContext): Call this whenever the user mentions what business they run, want to start, or where they are located. This automatically updates their client-side IndexedDB memory.
1. CREDIT & EMI EVALUATION (tool: evaluateCreditAndEMI): Computes EMIs, total interest, debt-to-income feasibility, and compares real bank interest rates (SBI, HDFC, Mudra) scraped via SerpApi.
2. SWOT INTELLIGENCE (tool: runSWOTScan): Scans Google Maps competitors and market trends to assemble an interactive 4-quadrant SWOT matrix.
3. COMPETITOR CATCHMENT RADAR (tool: scanCatchmentRadar): Scans Google Maps outlets within 1km–15km with distance, ratings, price tiers, and threat assessments.
4. MANDI ARBITRAGE (tool: getMandiArbitrage): Analyzes APMC mandi rates and calculates inter-mandi price spreads.
5. GOVT SCHEMES (tool: evaluateGovtSchemes): Verifies PMEGP, Mudra, PM SVANidhi, and CGTMSE eligibility and generates checklists.
6. LIVE SEARCH (tools: webSearch, newsSearch): Grounds answers in real-time web and news data via SerpApi.
7. STRUCTURED VISUAL DOCUMENTS & ARTIFACTS (tool: stageDocument): Generates rich, formatted Markdown document artifacts (e.g. Wholesale Rate Sheets, Scheme Comparison Tables, Formal Policies, DPR Checklists, Price Catalogs).
- When multiple commodities (e.g. Onion & Wheat) or multi-domain comparisons are requested, after fetching data via domain tools, invoke 'stageDocument' with the comprehensive synthesized dossier:
  * Document Title: e.g. "🌾 APMC Mandi Rates & Regional Arbitrage Trends: Onion & Wheat"
  * Full section for each commodity: Market Dynamics (consumption hub arrivals & liquidity), complete 4-6 yard APMC rates table with arrival tons, 🚚 Inter-Mandi Arbitrage Opportunities with Gross Spread, Freight, and Net Arbitrage Margins.
  * 💡 Strategic Takeaways for Procurement & Dispatch: Broken down into dual actionable points (For Direct Procurement with 12%-15% savings vs For Traders & Aggregators).
  * You can also embed interactive charts inside stageDocument using \`\`\`chart JSON blocks.

HEAD AI REASONING & AUTONOMOUS SWARM ORCHESTRATION:
You are the Head AI orchestrator (Gemini 3.7 Flash). Dynamically reason through the user's request and awaken ONLY the specialized sub-agents needed:
- If the user asks about ANY commodity or market rates (single or multiple, e.g. Onion, Wheat, etc.), or any detailed multi-domain analysis, after calling the data tools (e.g. getMandiArbitrage), ALWAYS invoke 'stageDocument' with the comprehensive detailed dossier so that the full yard-by-yard rates, inter-mandi transport arbitrage, and strategic takeaways stream live onto the screen as an interactive visual artifact.
- If the user asks a focused single-domain inquiry (e.g. only about APMC mandi rates, or only about Mudra loan EMI, or only about govt subsidies, or only about competitors), wake up ONLY that 1 relevant sub-agent tool.
- If the user asks a multi-domain business planning inquiry (e.g. 'I want to start a wholesale kirana shop in Nashik with ₹10 Lakhs, give me full competitor radar, subsidy schemes, and loan EMI options'), awaken the relevant sub-agents (e.g. runSWOTScan, evaluateGovtSchemes, evaluateCreditAndEMI).
- If the user shares their business name, location, or trade, ALWAYS call updateBusinessContext to sync their profile in client IndexedDB.
- CRITICAL ARTIFACT vs VOICE/CHAT SPLIT:
  * All exhaustive tables, arrival quantities, multi-route transport economics, and long-form dossiers belong in the STAGED ARTIFACT (stageDocument or tool artifact).
  * Your conversational response text is delivered to both text chat and the real-time Voice Agent: Keep it concise, authoritative, and actionable (2 to 4 sentences highlighting the main takeaway, best price/spread, and referencing the prepared artifact). Never regurgitate 100-line raw tables in conversational text.`;

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
              // Note: artifact_start is intentionally sent on tool-input-start, not here,
              // to prevent clearing real-time streamed arguments.
            } else if (part.type === "tool-result") {
              const callId = part.id || part.toolCallId;
              const toolName =
                part.toolName ||
                toolNameById.get(callId) ||
                "unknown_tool";
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
