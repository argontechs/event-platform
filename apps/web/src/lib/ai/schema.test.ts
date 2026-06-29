import { describe, it, expect } from "vitest";
import { AiMaterial, BotReply } from "./schema";

// FV-26 — AI-drafted material costs/quantities are bounded so a hallucinated or
// injected negative / NaN / absurd value can't become a real quote line.
describe("FV-26 AiMaterial bounds", () => {
  it("clamps a negative cost to 0", () => {
    expect(AiMaterial.parse({ name: "x", estCost: -9999, quantity: 1 }).estCost).toBe(0);
  });
  it("defaults a NaN quantity to 1", () => {
    expect(AiMaterial.parse({ name: "x", quantity: "abc", estCost: 10 }).quantity).toBe(1);
  });
  it("rejects an absurd cost (>10M)", () => {
    expect(AiMaterial.parse({ name: "x", estCost: 1e308, quantity: 1 }).estCost).toBeLessThanOrEqual(10_000_000);
  });
  it("keeps a valid material intact", () => {
    const m = AiMaterial.parse({ name: "Arch", quantity: 2, unit: "set", estCost: 250, analysis: "ok" });
    expect(m).toMatchObject({ name: "Arch", quantity: 2, estCost: 250 });
  });
});

// The WhatsApp bot drives side effects (lead creation, handoff) off model JSON,
// so the BotReply net must never throw and must reject an empty reply.
describe("BotReply parsing", () => {
  it("parses a valid reply, coercing numeric guests to string", () => {
    const r = BotReply.safeParse({
      reply: "Sure! What date?",
      action: "ask",
      leadData: { name: "Aisha", eventType: "wedding", guests: 200 },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.action).toBe("ask");
      expect(r.data.leadData.guests).toBe("200");
      expect(r.data.leadData.name).toBe("Aisha");
    }
  });
  it("fails when reply is empty (an empty WhatsApp body is rejected by Meta)", () => {
    expect(BotReply.safeParse({ reply: "", action: "ask", leadData: {} }).success).toBe(false);
    expect(BotReply.safeParse({ action: "ask", leadData: {} }).success).toBe(false);
  });
  it("falls back to action 'ask' on an invalid action", () => {
    const r = BotReply.safeParse({ reply: "hi", action: "DROP TABLE", leadData: {} });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.action).toBe("ask");
  });
  it("collapses a non-object leadData to {}", () => {
    const r = BotReply.safeParse({ reply: "hi", action: "ask", leadData: "ignore me" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.leadData).toEqual({});
  });
});
