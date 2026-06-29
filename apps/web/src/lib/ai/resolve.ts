import { decryptSecret } from "../crypto";
import type { AiProvider } from "./chat";

// Shared AI-key resolution (was duplicated in quotations/expenses actions).
// NOTE: testAiKeyAction in companies/actions.ts deliberately does NOT use this —
// it has distinct security semantics (typed-key-first, super-admin-gated env,
// no aiEnabled gate) and must stay separate.

type AiCompany = {
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
  aiApiKeyEnc: string | null;
};

export type ResolvedAiKey =
  | { ok: true; provider: AiProvider; key: string; model: string }
  | { ok: false; error: string };

/**
 * Resolve the text/vision provider + key + model for a company:
 *  - honour aiEnabled (disabled → no billable calls);
 *  - reconcile the model so an OpenAI id can never reach the Claude branch
 *    (a company switching provider but keeping aiModel="gpt-4o" would 404);
 *  - if a stored key won't decrypt, fail loudly rather than spend the env key;
 *  - prefix sanity-check the decrypted key against the provider (defence in
 *    depth; the primary guard is clearing the key on provider change);
 *  - only fall back to the provider's env key when NO company key is stored.
 */
export function resolveAiKey(company: AiCompany): ResolvedAiKey {
  if (!company.aiEnabled) return { ok: false, error: "AI features are disabled for this company." };

  const provider: AiProvider = company.aiProvider === "anthropic" ? "anthropic" : "openai";
  const stored = (company.aiModel ?? "").trim();
  const isClaude = stored.startsWith("claude-");
  const model =
    provider === "anthropic"
      ? isClaude
        ? stored
        : "claude-opus-4-8"
      : stored && !isClaude
        ? stored
        : "gpt-4o";

  if (company.aiApiKeyEnc) {
    const decrypted = decryptSecret(company.aiApiKeyEnc);
    if (!decrypted) {
      return { ok: false, error: "Saved AI key could not be decrypted — re-enter it in company settings." };
    }
    if (provider === "anthropic" && !decrypted.startsWith("sk-ant-")) {
      return { ok: false, error: "Saved key doesn't match the selected provider (Anthropic) — re-enter it." };
    }
    if (provider === "openai" && decrypted.startsWith("sk-ant-")) {
      return { ok: false, error: "Saved key doesn't match the selected provider (OpenAI) — re-enter it." };
    }
    return { ok: true, provider, key: decrypted, model };
  }

  const envKey = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (envKey) return { ok: true, provider, key: envKey, model };
  return {
    ok: false,
    error:
      provider === "anthropic"
        ? "No Anthropic API key configured for this company."
        : "No OpenAI API key configured for this company.",
  };
}

export type ResolvedImageKey = { ok: true; key: string } | { ok: false; error: string };

/**
 * Concept-image generation is OpenAI-only (Claude can't generate images), so
 * this ALWAYS resolves an OpenAI key regardless of the company's text provider:
 *  - provider=openai → the per-company key (if it isn't an Anthropic key), else env;
 *  - provider=anthropic → the single key slot holds an Anthropic key, so use env OPENAI_API_KEY only.
 */
export function resolveImageKey(company: {
  aiEnabled: boolean;
  aiProvider: string;
  aiApiKeyEnc: string | null;
}): ResolvedImageKey {
  if (!company.aiEnabled) return { ok: false, error: "AI features are disabled for this company." };

  const provider = company.aiProvider === "anthropic" ? "anthropic" : "openai";
  if (provider === "openai" && company.aiApiKeyEnc) {
    const decrypted = decryptSecret(company.aiApiKeyEnc);
    if (!decrypted) {
      return { ok: false, error: "Saved AI key could not be decrypted — re-enter it in company settings." };
    }
    if (!decrypted.startsWith("sk-ant-")) return { ok: true, key: decrypted };
    // Stored key looks like an Anthropic key under an OpenAI provider — fall through to env.
  }
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return { ok: true, key: envKey };
  return {
    ok: false,
    error: "Concept images require an OpenAI key — add an OpenAI key in company settings or set OPENAI_API_KEY.",
  };
}
