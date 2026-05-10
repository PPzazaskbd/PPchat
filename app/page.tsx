"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi. Send me a question and I will answer using your OpenRouter API key through the server route.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userMessage = input.trim();
    if (!userMessage || isLoading) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "The chat request failed.");
      }

      if (!data.reply) {
        throw new Error("The assistant returned an empty reply.");
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while sending the message.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Chat with DeepSeek">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Local learning chat</p>
            <h1>OpenRouter DeepSeek Chat</h1>
          </div>
          <span className="model-badge">deepseek/deepseek-v4-flash</span>
        </header>

        <div className="chat-history" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`message message-${message.role}`}
              key={`${message.role}-${index}`}
            >
              <p className="message-role">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              <p className="message-content">{message.content}</p>
            </article>
          ))}

          {isLoading ? (
            <article className="message message-assistant">
              <p className="message-role">Assistant</p>
              <p className="message-content loading-text">Thinking...</p>
            </article>
          ) : null}

          <div ref={endOfMessagesRef} />
        </div>

        {error ? <p className="error-message">{error}</p> : null}

        <form className="chat-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question..."
            rows={3}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "Sending" : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
