import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenRouterMessage = ChatMessage | {
  role: "system";
  content: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "deepseek/deepseek-v4-flash";
const SYSTEM_MESSAGE =
  "You are a helpful, concise assistant. Explain things clearly for a beginner computer engineering student.";

function isValidChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ChatMessage>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function shouldRetryWithoutReasoning(status: number, responseText: string) {
  const lowerResponse = responseText.toLowerCase();
  return (
    status >= 400 &&
    (lowerResponse.includes("reasoning") ||
      lowerResponse.includes("unsupported parameter") ||
      lowerResponse.includes("invalid parameter"))
  );
}

async function callOpenRouter({
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

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENROUTER_API_KEY is missing or blank. Add it to .env.local, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawMessages =
    body && typeof body === "object" && "messages" in body
      ? (body as { messages: unknown }).messages
      : undefined;

  if (!Array.isArray(rawMessages) || !rawMessages.every(isValidChatMessage)) {
    return NextResponse.json(
      { error: "Send an array of messages with role and content." },
      { status: 400 },
    );
  }

  const messages = rawMessages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
  const latestMessage = messages[messages.length - 1];

  if (
    !latestMessage ||
    latestMessage.role !== "user" ||
    latestMessage.content.length === 0
  ) {
    return NextResponse.json(
      { error: "Please send a non-empty user message." },
      { status: 400 },
    );
  }

  const openRouterMessages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_MESSAGE },
    ...messages,
  ];

  try {
    let response = await callOpenRouter({
      apiKey,
      messages: openRouterMessages,
      includeReasoning: true,
    });

    let responseText = await response.text();

    if (!response.ok && shouldRetryWithoutReasoning(response.status, responseText)) {
      response = await callOpenRouter({
        apiKey,
        messages: openRouterMessages,
        includeReasoning: false,
      });
      responseText = await response.text();
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = undefined;
    }

    if (!response.ok) {
      const providerMessage =
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (data as { error: { message: string } }).error.message
          : responseText || "OpenRouter returned an error.";

      return NextResponse.json(
        { error: `OpenRouter error: ${providerMessage}` },
        { status: response.status },
      );
    }

    const reply =
      data &&
      typeof data === "object" &&
      "choices" in data &&
      Array.isArray((data as { choices?: unknown }).choices)
        ? (data as { choices: Array<{ message?: { content?: unknown } }> })
            .choices[0]?.message?.content
        : undefined;

    if (typeof reply !== "string" || reply.trim().length === 0) {
      return NextResponse.json(
        { error: "OpenRouter returned an empty assistant message." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Could not reach OpenRouter. Check your network and API key." },
      { status: 502 },
    );
  }
}
