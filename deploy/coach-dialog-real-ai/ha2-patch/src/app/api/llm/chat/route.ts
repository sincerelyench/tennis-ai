import { NextRequest } from "next/server";
import { Config, LLMClient, type Message } from "coze-coding-dev-sdk";
import { getDoubaoSdkConfig } from "@/lib/ha2-ai-config";

export const runtime = "nodejs";

/** Prefer env model; lite seed endpoint is closed on Ark. */
function resolveChatModel() {
  const fromEnv = (process.env.DOUBAO_LLM_MODEL || "").trim();
  if (fromEnv) return fromEnv;
  return "doubao-seed-2-0-pro-260215";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    system?: string;
    messages?: { role: "user" | "assistant" | "system"; content: string }[];
  } | null;
  if (!body || !Array.isArray(body.messages)) {
    return new Response("Invalid request", { status: 400 });
  }

  const messages: Message[] = [];
  if (body.system) {
    messages.push({ role: "system", content: body.system });
  }
  for (const m of body.messages) {
    if (m.role === "system") continue;
    if (!m.content) continue;
    messages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }
  if (messages.length === 0) {
    return new Response("Empty conversation", { status: 400 });
  }

  const client = new LLMClient(new Config(getDoubaoSdkConfig()));
  const encoder = new TextEncoder();
  const model = resolveChatModel();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const gen = client.stream(messages, {
          model,
          temperature: 0.7,
          streaming: true,
        });
        for await (const chunk of gen) {
          // chunk.content 可能是 string 或 ContentPart[]
          const c = chunk.content;
          let text = "";
          if (typeof c === "string" && c.length > 0) {
            text = c;
          } else if (Array.isArray(c)) {
            text = c
              .map((p) => (typeof p === "object" && p && "text" in p ? p.text : ""))
              .join("");
          }
          if (text) {
            // Send as SSE format
            const sseData = `data: ${JSON.stringify({ content: text })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }
        }
        // Send done signal
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream error";
        try {
          const errorData = `data: ${JSON.stringify({ error: msg })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } catch {
          // ignore
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
      "X-HA2-LLM-Model": model,
    },
  });
}
