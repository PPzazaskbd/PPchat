import { Router, type Request, type Response } from "express";
import {
  callOpenRouter,
  isValidChatMessage,
  shouldRetryWithoutReasoning,
  SYSTEM_MESSAGE,
  type OpenRouterMessage,
} from "../lib/openrouter.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    res.status(500).json({
      error:
        "OPENROUTER_API_KEY is missing or blank. Add it to backend/.env, then restart the dev server.",
    });
    return;
  }

  const body = req.body;

  const rawMessages =
    body && typeof body === "object" && "messages" in body
      ? (body as { messages: unknown }).messages
      : undefined;

  if (!Array.isArray(rawMessages) || !rawMessages.every(isValidChatMessage)) {
    res
      .status(400)
      .json({ error: "Send an array of messages with role and content." });
    return;
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
    res.status(400).json({ error: "Please send a non-empty user message." });
    return;
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

    if (
      !response.ok &&
      shouldRetryWithoutReasoning(response.status, responseText)
    ) {
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

      res
        .status(response.status)
        .json({ error: `OpenRouter error: ${providerMessage}` });
      return;
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
      res
        .status(502)
        .json({ error: "OpenRouter returned an empty assistant message." });
      return;
    }

    res.json({ reply });
  } catch {
    res.status(502).json({
      error: "Could not reach OpenRouter. Check your network and API key.",
    });
  }
});

export default router;
