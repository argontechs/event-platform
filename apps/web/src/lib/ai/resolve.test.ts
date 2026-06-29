import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAiKey, resolveImageKey } from "./resolve";
import { encryptSecret } from "../crypto";

const base = {
  aiEnabled: true,
  aiModel: "gpt-4o",
  aiApiKeyEnc: null as string | null,
};

let savedOpenai: string | undefined;
beforeEach(() => {
  savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  if (savedOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedOpenai;
});

describe("resolveAiKey (OpenAI)", () => {
  it("returns disabled when aiEnabled is false", () => {
    expect(resolveAiKey({ ...base, aiEnabled: false }).ok).toBe(false);
  });

  it("reconciles a stray claude-* model back to gpt-4o", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const r = resolveAiKey({ ...base, aiModel: "claude-opus-4-8" });
    expect(r.ok && r.model).toBe("gpt-4o");
  });

  it("preserves a valid OpenAI model", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const r = resolveAiKey({ ...base, aiModel: "gpt-4o-mini" });
    expect(r.ok && r.model).toBe("gpt-4o-mini");
  });

  it("falls back to env OPENAI_API_KEY when no company key is stored", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const r = resolveAiKey({ ...base });
    expect(r.ok && r.key).toBe("sk-env");
  });

  it("prefers the stored company key over env", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const enc = encryptSecret("sk-company");
    const r = resolveAiKey({ ...base, aiApiKeyEnc: enc });
    expect(r.ok && r.key).toBe("sk-company");
  });

  it("errors when no key is available at all", () => {
    expect(resolveAiKey({ ...base }).ok).toBe(false);
  });
});

describe("resolveImageKey", () => {
  it("uses the stored company key", () => {
    const enc = encryptSecret("sk-company");
    const r = resolveImageKey({ aiEnabled: true, aiApiKeyEnc: enc });
    expect(r.ok && r.key).toBe("sk-company");
  });

  it("falls back to env OPENAI_API_KEY", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const r = resolveImageKey({ aiEnabled: true, aiApiKeyEnc: null });
    expect(r.ok && r.key).toBe("sk-env");
  });

  it("errors when no OpenAI key is available", () => {
    expect(resolveImageKey({ aiEnabled: true, aiApiKeyEnc: null }).ok).toBe(false);
  });
});
