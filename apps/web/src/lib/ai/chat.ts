// Provider-agnostic chat/vision dispatch for the text AI features (quote draft,
// reference brief, receipt OCR, WhatsApp bot). One branch point for OpenAI vs
// Anthropic so each feature function stays provider-neutral.
//
// Image GENERATION stays OpenAI-only (see openai.ts) — Claude cannot generate
// images, so those functions never route through here.

export type AiProvider = "openai" | "anthropic";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string }; // a `data:<mime>;base64,...` URL

export type ChatResult = { text: string; usage: { input: number; output: number } };

const ANTHROPIC_VERSION = "2023-06-01";

// Split a data: URL ("data:image/png;base64,XXXX") into an Anthropic image block.
// OpenAI accepts the data URL directly; Anthropic needs media_type + raw base64.
function dataUrlToAnthropicImage(
  dataUrl: string,
): { type: "image"; source: { type: "base64"; media_type: string; data: string } } | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
}

// Claude has no native JSON mode; it may wrap JSON in ```json fences or add a
// lead-in sentence. Pull out the JSON value so callers' JSON.parse() succeeds.
// No-op when the text is already clean JSON.
function extractJsonText(raw: string): string {
  let s = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const o = s.indexOf("{");
    const a = s.indexOf("[");
    const start = o === -1 ? a : a === -1 ? o : Math.min(o, a);
    const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (start !== -1 && end > start) s = s.slice(start, end + 1);
  }
  return s;
}

export async function callChat(opts: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  system: string;
  parts: ChatPart[];
  /** REQUIRED — the Anthropic Messages API rejects a missing max_tokens. */
  maxTokens: number;
  /** Applied ONLY on OpenAI. Claude (opus-4-8/4.7) rejects temperature with a 400. */
  temperature?: number;
  /** OpenAI: response_format json_object. Claude has no json mode → relies on the system prompt. */
  jsonMode?: boolean;
}): Promise<ChatResult> {
  if (opts.provider === "anthropic") {
    const content: unknown[] = [];
    for (const p of opts.parts) {
      if (p.type === "text") content.push({ type: "text", text: p.text });
      else {
        const img = dataUrlToAnthropicImage(p.dataUrl);
        if (img) content.push(img);
      }
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content }],
        // No temperature/top_p/top_k — removed (400) on claude-opus-4-8.
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return {
      // jsonMode callers JSON.parse this; strip fences/prose Claude may add.
      text: opts.jsonMode ? extractJsonText(text) : text,
      usage: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
    };
  }

  // OpenAI (chat/completions) — preserves the original request shape.
  const content = opts.parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image_url", image_url: { url: p.dataUrl } },
  );
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content },
      ],
      max_tokens: opts.maxTokens,
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    usage: { input: json.usage?.prompt_tokens ?? 0, output: json.usage?.completion_tokens ?? 0 },
  };
}

// ── Key test ──────────────────────────────────────────────────────────────
// Lists the account's models to validate auth + report capabilities. Works for
// both providers (both expose GET /v1/models → { data: [{ id }] }).
export async function testAiKey(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  const url =
    provider === "anthropic"
      ? "https://api.anthropic.com/v1/models"
      : "https://api.openai.com/v1/models";
  const headers: Record<string, string> =
    provider === "anthropic"
      ? { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION }
      : { Authorization: `Bearer ${apiKey}` };

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    return {
      ok: false,
      ids: [],
      error: err instanceof Error ? err.message : "Network error reaching the AI provider.",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `Provider rejected the key (HTTP ${res.status}).`;
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep default */
    }
    return { ok: false, ids: [], error: msg };
  }
  const json = (await res.json()) as { data?: { id?: string }[] };
  const ids = (json.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
  return { ok: true, ids };
}
