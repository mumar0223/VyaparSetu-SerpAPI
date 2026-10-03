import { generateText, streamText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createVertex } from "@ai-sdk/google-vertex";

// Dynamic language model instantiation using Vercel AI SDK
export function getLanguageModel(
  provider: string = "openai",
  model?: string,
): LanguageModel {
  switch (provider.toLowerCase()) {
    case "live":
    case "google-live":
    case "gemini-live":
    case "google-genai": {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const selectedModel =
        model ||
        process.env.LIVE_VOICE_MODEL ||
        "gemini-3.8-live";
      console.log(
        `[AI-PROVIDER] Instantiating Multimodal Live GenAI model: ${selectedModel}`,
      );

      const liveClient = createOpenAI({
        apiKey,
        baseURL:
          process.env.GEMINI_BASE_URL ||
          "https://generativelanguage.googleapis.com/v1beta/openai/",
      });

      const cleanModelName = selectedModel.replace(/^models\//, "");
      return liveClient.chat(cleanModelName);
    }

    case "vertex":
    case "google-vertex":
    case "gemini-vertex": {
      const project = process.env.GOOGLE_VERTEX_PROJECT;
      const location = process.env.GOOGLE_VERTEX_LOCATION || "global";
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;

      if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      const selectedModel =
        model || process.env.GOOGLE_VERTEX_MODEL || "gemini-3.7-flash";
      console.log(
        `[AI-PROVIDER] Instantiating Vertex AI Gemini model: ${selectedModel} (Project: ${project}, Location: ${location})`,
      );

      const vertexClient = createVertex({
        project,
        location,
        googleAuthOptions: {
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
        },
      });

      return vertexClient(selectedModel);
    }

    case "gemini":
    case "google": {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const selectedModel =
        model || process.env.GEMINI_MODEL || "gemini-3.7-flash";
      console.log(`[AI-PROVIDER] Instantiating Gemini model: ${selectedModel}`);

      const geminiClient = createOpenAI({
        apiKey,
        baseURL:
          process.env.GEMINI_BASE_URL ||
          "https://generativelanguage.googleapis.com/v1beta/openai/",
      });

      const cleanModelName = selectedModel.replace(/^models\//, "");
      return geminiClient.chat(cleanModelName);
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY || "";
      const baseURL = process.env.OPENAI_BASE_URL || undefined;
      const selectedModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
      console.log(`[AI-PROVIDER] Instantiating OpenAI model: ${selectedModel}`);

      const openaiClient = createOpenAI({
        apiKey,
        baseURL,
        fetch: async (url, init) => {
          if (init && init.body) {
            try {
              const body = JSON.parse(init.body as string);
              if (Array.isArray(body.tools)) {
                body.tools = body.tools.map((t: any) => {
                  const type = t.type || "function";
                  const name = t.name || t.function?.name;
                  const description = t.description || t.function?.description;
                  const parameters =
                    t.parameters || t.function?.parameters || {};

                  if (parameters) {
                    delete parameters.$schema;
                    delete parameters.additionalProperties;
                  }

                  return {
                    type,
                    function: {
                      name,
                      description,
                      parameters,
                    },
                  };
                });
                init.body = JSON.stringify(body);
              }
            } catch (e) {
              console.error("[OpenAI FETCH INTERCEPTOR ERROR]:", e);
            }
          }
          return fetch(url, init);
        },
      });

      return openaiClient.chat(selectedModel);
    }

    default:
      throw new Error(`Unsupported AI provider: "${provider}"`);
  }
}

// Unified dispatch function for executing models using Vercel AI SDK
export async function runAIModel(
  provider: string = "openai",
  model: string = process.env.OPENAI_MODEL || "gpt-4o-mini",
  systemInstruction: string = "",
  prompt: string = "",
): Promise<string> {
  const selectedModel =
    model ||
    (provider === "vertex" || provider === "google-vertex"
      ? process.env.GOOGLE_VERTEX_MODEL || "gemini-3.7-flash"
      : provider === "gemini" || provider === "google"
        ? process.env.GEMINI_MODEL || "gemini-3.7-flash"
        : process.env.OPENAI_MODEL || "gpt-4o-mini");
  console.log(
    `[AI-PROVIDER] Vercel AI SDK Dispatching to: ${provider} (model: ${selectedModel})`,
  );

  const modelInstance = getLanguageModel(provider, selectedModel);

  const { text } = await generateText({
    model: modelInstance,
    system: systemInstruction,
    prompt,
  });

  return text;
}
