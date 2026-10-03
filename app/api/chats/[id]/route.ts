import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/storage/chat-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = chatStore.getConversation(id);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    const messages = chatStore.getMessages(id);
    return NextResponse.json({ conversation: { ...conversation, messages } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load chat" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    chatStore.deleteConversation(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete chat" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updated = chatStore.updateConversation(id, body);
    return NextResponse.json({ conversation: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update chat" }, { status: 500 });
  }
}
