import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/storage/chat-store";
import { getLanguageModel } from "@/lib/agent/ai-provider";
import { TITLE_GENERATION_CONFIG } from "@/lib/agent/chat-config";
import { generateText } from "ai";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let fallbackTitle = "New Conversation";
  let convId = "";
  try {
    const { id } = await params;
    convId = id || "";
    const body = await req.json().catch(() => ({}));
    const turns = Array.isArray(body.turns) ? body.turns : [];
    const message = typeof body.message === "string" ? body.message : "";
    const firstUserTurn = turns[0]?.user || message || "";

    if (!firstUserTurn.trim()) {
      return NextResponse.json({ success: true, title: fallbackTitle });
    }

    fallbackTitle = firstUserTurn.slice(0, 36).trim() + "...";
    let title = fallbackTitle;

    try {
      const model = getLanguageModel(TITLE_GENERATION_CONFIG.provider, TITLE_GENERATION_CONFIG.model);
      const res = await generateText({
        model,
        prompt: `Generate a short 3-5 word title for a research conversation starting with: "${firstUserTurn}". Output ONLY the title, no quotes.`,
      });
      if (res.text?.trim()) {
        title = res.text.trim().replace(/^["']|["']$/g, "").slice(0, 50);
      }
    } catch {
      // Fallback to slice
    }

    if (convId) {
      chatStore.updateConversation(convId, { title });
    }
    return NextResponse.json({ success: true, title });
  } catch (error: any) {
    return NextResponse.json({ success: true, title: fallbackTitle });
  }
}
