export interface ToolCallItem {
  toolName: string;
  toolCallId?: string;
  type?: string;
  url?: string;
  icon?: string;
  summary?: string;
  status?: "calling" | "completed" | "error";
  args?: Record<string, any>;
  result?: any;
}


export type AttachmentType = "DOCUMENT" | "IMAGE" | "PDF" | "SHEET";

export interface ChatAttachment {
  id?: string;
  name?: string;
  url: string;
  type: AttachmentType | "image" | "file";
  mimeType?: string;
  size?: number;
  uploadedName?: string;
  savedName?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolCalls?: ToolCallItem[];
  files?: string[];
  attachments?: ChatAttachment[];
  createdAt?: string | Date;
  isStreaming?: boolean;
  thoughtDurationSeconds?: number;
}



export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}
