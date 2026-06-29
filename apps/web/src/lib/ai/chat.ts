// Chat/vision dispatch for the text AI features (quote draft, reference brief,
// receipt OCR, WhatsApp bot) — all on OpenAI. Image GENERATION lives in
// openai.ts (gpt-image-1).

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string }; // a `data:<mime>;base64,...` URL

export type ChatResult = { text: string; usage: { input: number; output: number } };

export async function callChat(opts: {
  apiKey: string;
  model: string;
  system: string;
  parts: ChatPart[];
  maxTokens: number;
  temperature?: number;
  /** response_format json_object — forces strict JSON for callers that JSON.parse the result. */
  jsonMode?: boolean;
}): Promise<ChatResult> {
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
// Lists the account's models to validate auth + report capabilities
// (GET /v1/models → { data: [{ id }] }).
export async function testAiKey(
  apiKey: string,
): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    return {
      ok: false,
      ids: [],
      error: err instanceof Error ? err.message : "Network error reaching OpenAI.",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `OpenAI rejected the key (HTTP ${res.status}).`;
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
