import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAiKey, resolveImageKey } from "./resolve";
import { encryptSecret } from "../crypto";

const base = {
  aiEnabled: true,
  aiProvider: "openai",
  aiModel: "gpt-4o",
  aiApiKeyEnc: null as string | null,
};

let savedOpenai: string | undefined;
let savedAnthropic: string | undefined;

beforeEach(() => {
  savedOpenai = process.env.OPENAI_API_KEY;
  savedAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  if (savedOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedOpenai;
  if (savedAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedAnthropic;
});

describe("resolveAiKey", () => {
  it("returns disabled when aiEnabled is false", () => {
    expect(resolveAiKey({ ...base, aiEnabled: false }).ok).toBe(false);
  });

  it("never sends an OpenAI model to the Claude branch (gpt-4o → claude-opus-4-8)", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env";
    const r = resolveAiKey({ ...base, aiProvider: "anthropic", aiModel: "gpt-4o" });
    expect(r.ok && r.provider).toBe("anthropic");
    expect(r.ok && r.model).toBe("claude-opus-4-8");
    expect(r.ok && r.key).toBe("sk-ant-env");
  });

  it("preserves a claude-* model on the anthropic provider", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env";
    const r = resolveAiKey({ ...base, aiProvider: "anthropic", aiModel: "claude-haiku-4-5" });
    expect(r.ok && r.model).toBe("claude-haiku-4-5");
  });

  it("reconciles a claude model on the openai provider back to gpt-4o", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const r = resolveAiKey({ ...base, aiProvider: "openai", aiModel: "claude-opus-4-8" });
    expect(r.ok && r.model).toBe("gpt-4o");
  });

  it("falls back to the provider's env key when no company key is stored", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    expect((resolveAiKey({ ...base }) as { key?: string }).key).toBe("sk-env");
  });

  it("rejects a stored OpenAI key under the anthropic provider", () => {
    const enc = encryptSecret("sk-openai-key");
    expect(resolveAiKey({ ...base, aiProvider: "anthropic", aiApiKeyEnc: enc }).ok).toBe(false);
  });

  it("rejects a stored Anthropic key under the openai provider", () => {
    const enc = encryptSecret("sk-ant-anthropic-key");
    expect(resolveAiKey({ ...base, aiProvider: "openai", aiApiKeyEnc: enc }).ok).toBe(false);
  });

  it("accepts a matching stored anthropic key", () => {
    const enc = encryptSecret("sk-ant-good");
    const r = resolveAiKey({ ...base, aiProvider: "anthropic", aiModel: "claude-opus-4-8", aiApiKeyEnc: enc });
    expect(r.ok && r.key).toBe("sk-ant-good");
  });
});

describe("resolveImageKey (always OpenAI)", () => {
  it("uses env OPENAI_API_KEY for an anthropic company (Claude can't make images)", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const enc = encryptSecret("sk-ant-good");
    const r = resolveImageKey({ aiEnabled: true, aiProvider: "anthropic", aiApiKeyEnc: enc });
    expect(r.ok && r.key).toBe("sk-env");
  });

  it("errors when no OpenAI key is available for an anthropic company", () => {
    const enc = encryptSecret("sk-ant-good");
    expect(resolveImageKey({ aiEnabled: true, aiProvider: "anthropic", aiApiKeyEnc: enc }).ok).toBe(false);
  });

  it("uses the company OpenAI key for an openai company", () => {
    const enc = encryptSecret("sk-company");
    const r = resolveImageKey({ aiEnabled: true, aiProvider: "openai", aiApiKeyEnc: enc });
    expect(r.ok && r.key).toBe("sk-company");
  });
});
