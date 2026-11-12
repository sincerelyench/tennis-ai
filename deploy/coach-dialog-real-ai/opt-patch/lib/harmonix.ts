export const HARMONIX_CHAT_URL = (
  process.env.HARMONIX_CHAT_URL || "http://127.0.0.1:15000/ha2/api/llm/chat"
).replace(/\/$/, "");

export const HARMONIX_CHAT_PUBLIC = "https://yqchen.blog/ha2/api/llm/chat";

type HarmonixMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function harmonixChat(system: string, messages: HarmonixMessage[]) {
  const payload = {
    system,
    messages: messages.filter((item) => item.role !== "system" && item.content.trim()),
  };

  const urls = [HARMONIX_CHAT_URL];
  if (!urls.includes(HARMONIX_CHAT_PUBLIC)) urls.push(HARMONIX_CHAT_PUBLIC);

  let lastError = "The coach chat service did not respond";
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        lastError = `Coach chat returned ${response.status}`;
        continue;
      }
      const text = await collectSseText(response);
      if (text.trim()) return text;
      lastError = "The coach chat service did not return text";
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function collectSseText(response: Response) {
  if (!response.body) {
    const fallback = await response.text();
    return parseSseBuffer(fallback);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const piece = readSseData(part);
      if (piece === "[DONE]") return text;
      if (piece) text += piece;
    }
  }
  if (buffer) {
    const piece = readSseData(buffer);
    if (piece && piece !== "[DONE]") text += piece;
  }
  return text || parseSseBuffer(decoder.decode());
}

function readSseData(block: string) {
  const lines = block.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return data || "";
    try {
      const parsed = JSON.parse(data) as { content?: string; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      return parsed.content || "";
    } catch (error) {
      if (error instanceof SyntaxError) return data;
      throw error;
    }
  }
  return "";
}

function parseSseBuffer(raw: string) {
  return raw
    .split("\n\n")
    .map(readSseData)
    .filter((item) => item && item !== "[DONE]")
    .join("");
}
