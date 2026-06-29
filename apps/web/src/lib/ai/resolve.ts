import { decryptSecret } from "../crypto";

// Shared AI-key resolution (was duplicated in quotations/expenses actions).
// NOTE: testAiKeyAction in companies/actions.ts deliberately does NOT use this —
// it has distinct security semantics (typed-key-first, super-admin-gated env,
// no aiEnabled gate) and must stay separate.

type AiCompany = {
  aiEnabled: boolean;
  aiModel: string;
  aiApiKeyEnc: string | null;
};

export type ResolvedAiKey =
  | { ok: true; key: string; model: string }
  | { ok: false; error: string };

/**
 * Resolve the OpenAI key + model for a company:
 *  - honour aiEnabled (disabled → no billable calls);
 *  - reconcile the model so a stray non-OpenAI id can't 404;
 *  - if a stored key won't decrypt, fail loudly rather than spend the env key;
 *  - only fall back to env OPENAI_API_KEY when NO company key is stored.
 */
export function resolveAiKey(company: AiCompany): ResolvedAiKey {
  if (!company.aiEnabled) return { ok: false, error: "AI features are disabled for this company." };

  const stored = (company.aiModel ?? "").trim();
  const model = stored && !stored.startsWith("claude-") ? stored : "gpt-4o";

  if (company.aiApiKeyEnc) {
    const decrypted = decryptSecret(company.aiApiKeyEnc);
    if (!decrypted) {
      return { ok: false, error: "Saved AI key could not be decrypted — re-enter it in company settings." };
    }
    return { ok: true, key: decrypted, model };
  }

  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return { ok: true, key: envKey, model };
  return { ok: false, error: "No OpenAI API key configured for this company." };
}

export type ResolvedImageKey = { ok: true; key: string } | { ok: false; error: string };

/** Concept-image generation (gpt-image-1) — resolves the company's OpenAI key, else env. */
export function resolveImageKey(company: {
  aiEnabled: boolean;
  aiApiKeyEnc: string | null;
}): ResolvedImageKey {
  if (!company.aiEnabled) return { ok: false, error: "AI features are disabled for this company." };

  if (company.aiApiKeyEnc) {
    const decrypted = decryptSecret(company.aiApiKeyEnc);
    if (!decrypted) {
      return { ok: false, error: "Saved AI key could not be decrypted — re-enter it in company settings." };
    }
    return { ok: true, key: decrypted };
  }
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return { ok: true, key: envKey };
  return {
    ok: false,
    error: "Concept images require an OpenAI key — add one in company settings or set OPENAI_API_KEY.",
  };
}
