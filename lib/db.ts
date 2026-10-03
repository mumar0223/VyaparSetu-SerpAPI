import Dexie, { type Table } from "dexie";

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  files?: string[];
  thinking?: string;
  toolCalls?: any[];
  thoughtDurationSeconds?: number;
  createdAt: number;
}

export interface BusinessProfile {
  id: "active";
  businessName: string;
  ownerName?: string;
  category: string;
  city: string;
  district: string;
  pincode?: string;
  monthlyTurnover?: string;
  annualRevenue?: number;
  monthlyExpenses?: number;
  gstNumber?: string;
  udyamNumber?: string;
  source: "preset" | "auto_extracted" | "manual";
  updatedAt: number;
}

export type UserProfile = BusinessProfile;

export interface EnterpriseIntelligence {
  id: "latest";
  summary?: string;
  awakenedDomains?: string[]; // e.g. ["swot", "schemes", "mandi", "competitors", "credit"]
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    actionPlan?: string[];
  };
  schemes?: Array<{
    title: string;
    department?: string;
    subsidy: string;
    eligibility: string;
    deadline?: string;
    applicationUrl?: string;
    badge?: string;
    amount?: string;
    interest?: string;
  }>;
  mandi?: Array<{
    name: string;
    variety?: string;
    modalPrice: string;
    unit?: string;
    trend: string;
    positive?: boolean;
    arrivals?: string;
    market?: string;
    arbitrageOpp?: string;
  }>;
  competitors?: Array<{
    name: string;
    distance: string;
    rating: number;
    priceRange?: string;
    differentiator: string;
    threatLevel?: "Low" | "Medium" | "High";
  }>;
  credit?: {
    estimatedCibilScore: number;
    healthGrade: string;
    dscr: string;
    maxRecommendedLoan: string;
    recommendations: string[];
  };
  updatedAt: number;
}

export class VyaparSetuDatabase extends Dexie {
  conversations!: Table<ConversationRecord, string>;
  messages!: Table<MessageRecord, string>;
  business_profile!: Table<BusinessProfile, string>;
  enterprise_intelligence!: Table<EnterpriseIntelligence, string>;

  constructor() {
    super("VyaparSetuWorkspaceDB");
    this.version(1).stores({
      conversations: "id, updatedAt, createdAt, pinned",
      messages: "id, conversationId, role, createdAt",
      business_profile: "id, updatedAt",
    });
    this.version(2).stores({
      conversations: "id, updatedAt, createdAt, pinned",
      messages: "id, conversationId, role, createdAt",
      business_profile: "id, updatedAt",
      enterprise_intelligence: "id, updatedAt",
    });
  }
}

export const db = new VyaparSetuDatabase();

// ── 1. CONVERSATIONS CRUD ──

export async function getAllConversations(): Promise<ConversationRecord[]> {
  try {
    const list = await db.conversations.toArray();
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  } catch (err) {
    console.error("[Dexie] getAllConversations error:", err);
    return [];
  }
}

export async function getConversationById(
  id: string,
): Promise<ConversationRecord | undefined> {
  try {
    return await db.conversations.get(id);
  } catch (err) {
    console.error("[Dexie] getConversationById error:", err);
    return undefined;
  }
}

export async function saveConversation(
  conv: ConversationRecord,
): Promise<string> {
  await db.conversations.put(conv);
  return conv.id;
}

export async function updateConversation(
  id: string,
  updates: Partial<ConversationRecord>,
): Promise<void> {
  const existing = await db.conversations.get(id);
  if (existing) {
    await db.conversations.put({
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction("rw", [db.conversations, db.messages], async () => {
    await db.conversations.delete(id);
    await db.messages.where("conversationId").equals(id).delete();
  });
}

// ── 2. MESSAGES CRUD ──

export async function getMessagesByConversationId(
  conversationId: string,
): Promise<MessageRecord[]> {
  try {
    let list = await db.messages
      .where("conversationId")
      .equals(conversationId)
      .toArray();

    // Fallback scan in case index key collation differed
    if (!list || list.length === 0) {
      const all = await db.messages.toArray();
      list = all.filter((m) => m.conversationId === conversationId);
    }

    return list.sort((a, b) => {
      const timeA =
        typeof a.createdAt === "number"
          ? a.createdAt
          : new Date(a.createdAt || 0).getTime();
      const timeB =
        typeof b.createdAt === "number"
          ? b.createdAt
          : new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  } catch (err) {
    console.error("[Dexie] getMessagesByConversationId error:", err);
    return [];
  }
}

export async function saveMessage(msg: MessageRecord): Promise<string> {
  const sanitized: MessageRecord = {
    ...msg,
    createdAt: typeof msg.createdAt === "number" ? msg.createdAt : Date.now(),
  };
  await db.messages.put(sanitized);
  return sanitized.id;
}

// ── 3. BUSINESS PROFILE & LOCATION MEMORY ──

export async function getActiveBusinessProfile(): Promise<BusinessProfile | null> {
  try {
    const profile = await db.business_profile.get("active");
    return profile || null;
  } catch (err) {
    console.error("[Dexie] getActiveBusinessProfile error:", err);
    return null;
  }
}

export async function saveBusinessProfile(
  profileData: Partial<BusinessProfile>,
): Promise<BusinessProfile> {
  const existing = (await getActiveBusinessProfile()) || {
    businessName: "",
    category: "",
    city: "",
    district: "",
    source: "auto_extracted" as const,
  };

  const updated: BusinessProfile = {
    ...existing,
    ...profileData,
    id: "active",
    updatedAt: Date.now(),
  };

  await db.business_profile.put(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vyaparsetu:profile-updated", { detail: updated }),
    );
  }

  return updated;
}

export async function clearBusinessProfile(): Promise<void> {
  await db.business_profile.delete("active");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vyaparsetu:profile-cleared"));
  }
}

export const getUserProfile = getActiveBusinessProfile;
export const saveUserProfile = saveBusinessProfile;

// ── 4. ENTERPRISE INTELLIGENCE CRUD ──

export async function getEnterpriseIntelligence(): Promise<EnterpriseIntelligence | null> {
  try {
    const data = await db.enterprise_intelligence.get("latest");
    return data || null;
  } catch (err) {
    console.error("[Dexie] getEnterpriseIntelligence error:", err);
    return null;
  }
}

export async function saveEnterpriseIntelligence(
  incoming: Partial<EnterpriseIntelligence>,
): Promise<EnterpriseIntelligence> {
  const existing = (await getEnterpriseIntelligence()) || {
    id: "latest" as const,
    updatedAt: Date.now(),
  };

  // Merge domains progressively without wiping previously analyzed data
  const updated: EnterpriseIntelligence = {
    ...existing,
    ...incoming,
    id: "latest",
    summary: incoming.summary || existing.summary,
    swot: incoming.swot || existing.swot,
    schemes: incoming.schemes || existing.schemes,
    mandi: incoming.mandi || existing.mandi,
    competitors: incoming.competitors || existing.competitors,
    credit: incoming.credit || existing.credit,
    awakenedDomains: Array.from(
      new Set([
        ...(existing.awakenedDomains || []),
        ...(incoming.awakenedDomains || []),
      ]),
    ),
    updatedAt: Date.now(),
  };

  await db.enterprise_intelligence.put(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vyaparsetu:intelligence-updated", { detail: updated }),
    );
  }

  return updated;
}

