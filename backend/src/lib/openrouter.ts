export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenRouterMessage =
  | ChatMessage
  | { role: "system"; content: string };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "deepseek/deepseek-v4-flash";

export const SYSTEM_MESSAGE =
  "You are a helpful, concise assistant. Explain things clearly for a beginner computer engineering student.";

export function isValidChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ChatMessage>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

export function shouldRetryWithoutReasoning(
  status: number,
  responseText: string,
) {
  const lowerResponse = responseText.toLowerCase();
  return (
    status >= 400 &&
    (lowerResponse.includes("reasoning") ||
      lowerResponse.includes("unsupported parameter") ||
      lowerResponse.includes("invalid parameter"))
  );
}

export async function callOpenRouter({
  apiKey,
  messages,
  includeReasoning,
}: {
  apiKey: string;
  messages: OpenRouterMessage[];
  includeReasoning: boolean;
}) {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      ...(includeReasoning
        ? { reasoning: { effort: "high", exclude: true } }
        : {}),
      temperature: 0.7,
    }),
  });
}
