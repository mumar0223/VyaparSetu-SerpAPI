/**
 * Pure Client-Side Zero-Server Storage using Browser IndexedDB.
 * Manages conversation history, message threads, staged artifacts,
 * and live simulation states completely offline or client-side with 0 database setup.
 */

export interface ResearchConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolCalls?: any[];
  artifacts?: any[];
  files?: any[];
  createdAt: number;
}

export interface ResearchArtifactRecord {
  id: string;
  conversationId: string;
  artifactType: string;
  title: string;
  summary?: string;
  data: any;
  createdAt: number;
}

const DB_NAME = "SerpApiResearchAgentDB";
const DB_VERSION = 1;

class ResearchDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("IndexedDB is only available in browser environment"));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains("conversations")) {
            const convStore = db.createObjectStore("conversations", { keyPath: "id" });
            convStore.createIndex("updatedAt", "updatedAt", { unique: false });
          }
          if (!db.objectStoreNames.contains("messages")) {
            const msgStore = db.createObjectStore("messages", { keyPath: "id" });
            msgStore.createIndex("conversationId", "conversationId", { unique: false });
            msgStore.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!db.objectStoreNames.contains("artifacts")) {
            const artStore = db.createObjectStore("artifacts", { keyPath: "id" });
            artStore.createIndex("conversationId", "conversationId", { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  // ── Conversation Operations ──
  async getConversations(): Promise<ResearchConversation[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("conversations", "readonly");
        const store = tx.objectStore("conversations");
        const index = store.index("updatedAt");
        const req = index.openCursor(null, "prev");
        const results: ResearchConversation[] = [];

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[ResearchDB] Fallback reading conversations:", err);
      return [];
    }
  }

  async saveConversation(conv: ResearchConversation): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put(conv);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["conversations", "messages", "artifacts"], "readwrite");
      tx.objectStore("conversations").delete(id);

      // Clean related messages
      const msgStore = tx.objectStore("messages");
      const msgIndex = msgStore.index("conversationId");
      const msgReq = msgIndex.openKeyCursor(IDBKeyRange.only(id));
      msgReq.onsuccess = () => {
        const cursor = msgReq.result;
        if (cursor) {
          msgStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Message Operations ──
  async getMessages(conversationId: string): Promise<ResearchMessage[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("messages", "readonly");
        const index = tx.objectStore("messages").index("conversationId");
        const req = index.getAll(IDBKeyRange.only(conversationId));
        req.onsuccess = () => {
          const msgs = (req.result || []) as ResearchMessage[];
          msgs.sort((a, b) => a.createdAt - b.createdAt);
          resolve(msgs);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[ResearchDB] Error reading messages:", err);
      return [];
    }
  }

  async saveMessage(msg: ResearchMessage): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["messages", "conversations"], "readwrite");
      tx.objectStore("messages").put(msg);

      // Update conversation updatedAt
      const convStore = tx.objectStore("conversations");
      const getReq = convStore.get(msg.conversationId);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const conv = getReq.result as ResearchConversation;
          conv.updatedAt = Date.now();
          convStore.put(conv);
        } else {
          convStore.put({
            id: msg.conversationId,
            title: msg.content ? msg.content.slice(0, 35) + "..." : "New Research Session",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Artifact Operations ──
  async saveArtifact(art: ResearchArtifactRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("artifacts", "readwrite");
      tx.objectStore("artifacts").put(art);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getArtifacts(conversationId: string): Promise<ResearchArtifactRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("artifacts", "readonly");
      const index = tx.objectStore("artifacts").index("conversationId");
      const req = index.getAll(IDBKeyRange.only(conversationId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export const researchDB = new ResearchDB();
