/**
 * In-Memory Chat Store (Zero Filesystem Writes, 100% Vercel & Serverless Safe).
 * Real durable persistent storage is handled 100% by the client's Dexie / IndexedDB
 * (matching the ArchiText architecture).
 */

export interface StoredConversation {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolCalls?: any[];
  files?: any[];
  createdAt: string;
}

const memoryConversations = new Map<string, StoredConversation>();
const memoryMessages = new Map<string, StoredMessage[]>();

export const chatStore = {
  getConversations(): StoredConversation[] {
    return Array.from(memoryConversations.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  getConversation(id: string): StoredConversation | null {
    return memoryConversations.get(id) || null;
  },

  createConversation(title: string = "New Conversation", explicitId?: string): StoredConversation {
    const conv: StoredConversation = {
      id: explicitId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryConversations.set(conv.id, conv);
    return conv;
  },

  updateConversation(
    id: string,
    updates: Partial<StoredConversation>,
  ): StoredConversation | null {
    const existing = memoryConversations.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryConversations.set(id, updated);
    return updated;
  },

  deleteConversation(id: string): boolean {
    memoryConversations.delete(id);
    memoryMessages.delete(id);
    return true;
  },

  getMessages(conversationId: string): StoredMessage[] {
    return memoryMessages.get(conversationId) || [];
  },

  addMessage(message: Omit<StoredMessage, "id" | "createdAt">): StoredMessage {
    const newMsg: StoredMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const list = memoryMessages.get(message.conversationId) || [];
    list.push(newMsg);
    memoryMessages.set(message.conversationId, list);

    const conv = memoryConversations.get(message.conversationId);
    if (conv) {
      conv.updatedAt = new Date().toISOString();
      memoryConversations.set(conv.id, conv);
    }

    return newMsg;
  },

  upsertMessage(
    message: Partial<StoredMessage> & {
      id: string;
      conversationId: string;
      role: "user" | "assistant" | "system";
    },
  ): StoredMessage {
    const list = memoryMessages.get(message.conversationId) || [];
    const idx = list.findIndex((m) => m.id === message.id);
    let result: StoredMessage;
    if (idx >= 0) {
      result = {
        ...list[idx],
        ...message,
        createdAt: list[idx].createdAt || message.createdAt || new Date().toISOString(),
      };
      list[idx] = result;
    } else {
      result = {
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content || "",
        thinking: message.thinking,
        toolCalls: message.toolCalls,
        files: message.files,
        createdAt: message.createdAt || new Date().toISOString(),
      };
      list.push(result);
    }
    memoryMessages.set(message.conversationId, list);

    const conv = memoryConversations.get(message.conversationId);
    if (conv) {
      conv.updatedAt = new Date().toISOString();
      memoryConversations.set(conv.id, conv);
    }

    return result;
  },
};
