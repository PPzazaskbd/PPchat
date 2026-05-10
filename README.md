ill edit this later , please read my ai slop for now
# OpenRouter DeepSeek Chat

A minimal Next.js App Router chat app that sends messages to a server API route, then calls OpenRouter with your private API key.

## Install Dependencies

```bash
npm install
```

## Create `.env.local`

Copy the example file:

```bash
cp .env.local.example .env.local
```

Then replace the placeholder with your OpenRouter API key:

```bash
OPENROUTER_API_KEY=your_real_key_here
```

Do not use `NEXT_PUBLIC_OPENROUTER_API_KEY`. Variables prefixed with `NEXT_PUBLIC_` can be bundled into browser code.

## Run The App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Where To Change The Model

Change the model name in:

```text
app/api/chat/route.ts
```

Look for:

```ts
const MODEL_NAME = "deepseek/deepseek-v4-flash";
```

## Why The API Key Stays On The Server

Browser code can be viewed by anyone using developer tools. If the API key were sent to the frontend, anyone using the app could copy it and spend your OpenRouter credits.

This app keeps the key inside `app/api/chat/route.ts`, which runs on the server. The frontend only calls your own `/api/chat` route and never sees `OPENROUTER_API_KEY`.
