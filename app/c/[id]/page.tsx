import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatWorkspace initialChatId={id} />;
}
