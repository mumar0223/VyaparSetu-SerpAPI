import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/storage/chat-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = chatStore.getMessages(id);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to get messages" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (body.userTranscript || body.assistantTranscript || body.turnId) {
      const messagesAdded = [];
      const turnId = body.turnId || `turn_${Date.now()}`;
      const userMsgId = `u_${turnId}`;
      const asstMsgId = `a_${turnId}`;
      const createdAt = body.startedAt ? new Date(body.startedAt).toISOString() : new Date().toISOString();

      if (
        (body.userTranscript && typeof body.userTranscript === "string" && body.userTranscript.trim()) ||
        (Array.isArray(body.files) && body.files.length > 0)
      ) {
        messagesAdded.push(
          chatStore.upsertMessage({
            id: userMsgId,
            conversationId: id,
            role: "user",
            content: (body.userTranscript || "").trim(),
            files: body.files,
            createdAt,
          })
        );
      }
      if (
        (body.assistantTranscript && typeof body.assistantTranscript === "string" && body.assistantTranscript.trim()) ||
        (Array.isArray(body.toolCalls) && body.toolCalls.length > 0)
      ) {
        messagesAdded.push(
          chatStore.upsertMessage({
            id: asstMsgId,
            conversationId: id,
            role: "assistant",
            content: (body.assistantTranscript || "").trim(),
            thinking: body.thinking,
            toolCalls: body.toolCalls,
            createdAt: body.startedAt ? new Date(body.startedAt + 1).toISOString() : new Date().toISOString(),
          })
        );
      }
      return NextResponse.json({ messages: messagesAdded, success: true });
    }

    if (body.id) {
      const message = chatStore.upsertMessage({
        id: body.id,
        conversationId: id,
        role: body.role || "user",
        content: body.content || "",
        thinking: body.thinking,
        toolCalls: body.toolCalls,
        files: body.files,
        createdAt: body.createdAt ? new Date(body.createdAt).toISOString() : new Date().toISOString(),
      });
      return NextResponse.json({ message });
    }

    const message = chatStore.addMessage({
      conversationId: id,
      role: body.role || "user",
      content: body.content || "",
      thinking: body.thinking,
      toolCalls: body.toolCalls,
      files: body.files,
    });
    return NextResponse.json({ message });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to add message" }, { status: 500 });
  }
}
