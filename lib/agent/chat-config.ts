/**
 * Dedicated isolated configuration for the Dashboard Chat Advisor.
 * Powered by Google Cloud Vertex AI Gemini 3.7 Flash on global location.
 */
export const DASHBOARD_CHAT_CONFIG = {
  provider: "vertex",
  model: process.env.GOOGLE_VERTEX_MODEL || "gemini-3.7-flash",
  temperature: 0.7,
};

/**
 * Dedicated AI configuration for Title Generation.
 * Reads the title model name from env (GOOGLE_VERTEX_MODEL).
 */
export const TITLE_GENERATION_CONFIG = {
  provider: "vertex",
  model: process.env.GOOGLE_VERTEX_MODEL || "gemini-3.7-flash",
  temperature: 0.3,
  maxTokens: 30,
};

/**
 * Dedicated centralized configuration for the Multimodal Live Voice Agent OS.
 * Uses official Live models with dedicated "google-live" provider.
 */
export const LIVE_VOICE_AGENT_CONFIG = {
  provider: "vertex",
  model: process.env.LIVE_VOICE_MODEL || "gemini-3.8-live",
  liveModels: [
    "gemini-3.8-live",
  ] as const,
  voiceName: process.env.LIVE_VOICE_NAME || "Puck",
  responseModalities: ["AUDIO"],
};

export const SUPPORTED_INDIAN_LANGUAGES = [
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी" },
  { code: "en-IN", name: "English", nativeName: "English" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
] as const;

export type SupportedLanguageCode =
  (typeof SUPPORTED_INDIAN_LANGUAGES)[number]["code"];
