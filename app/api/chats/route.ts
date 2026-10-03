import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/storage/chat-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conversations = chatStore.getConversations();
    return NextResponse.json({ conversations });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 100)
      : "New Conversation";

    const conversation = chatStore.createConversation(title);
    return NextResponse.json({ conversation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create conversation" }, { status: 500 });
  }
}
