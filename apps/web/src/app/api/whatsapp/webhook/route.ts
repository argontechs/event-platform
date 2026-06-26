import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@event/db";
import { startBot, handleBotAnswer } from "@/lib/whatsapp/bot";

export const dynamic = "force-dynamic";

// Hard caps so a forged/oversized payload can't fan out unbounded DB work.
const MAX_ENTRIES = 20;
const MAX_MESSAGES = 50;

/**
 * Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body, keyed by the
 * app secret). Fails closed: if WHATSAPP_APP_SECRET is unset the webhook is
 * rejected outright rather than processing unauthenticated input.
 */
function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Meta verifies the webhook with a GET challenge using your verify token.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: { from?: string; id?: string; type?: string; text?: { body?: string } }[];
  statuses?: { id?: string; status?: string }[];
};

// Inbound messages + delivery statuses. Always 200 so Meta doesn't retry-storm.
export async function POST(req: NextRequest) {
  // Read the raw body and authenticate BEFORE trusting any of it.
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: { entry?: { changes?: { value?: WaValue }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }

  try {
    for (const entry of (payload?.entry ?? []).slice(0, MAX_ENTRIES)) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const company = await prisma.company.findFirst({
          where: { waPhoneNumberId: phoneNumberId },
          select: {
            id: true, name: true, quotePrefix: true, waBotEnabled: true,
            waPhoneNumberId: true, waAccessTokenEnc: true,
          },
        });
        if (!company) continue;

        const names = new Map<string, string>();
        for (const c of value?.contacts ?? []) {
          if (c?.wa_id) names.set(c.wa_id, c?.profile?.name ?? "");
        }

        for (const m of (value?.messages ?? []).slice(0, MAX_MESSAGES)) {
          const from = String(m?.from ?? "");
          if (!from) continue;
          const text = m?.text?.body ?? (m?.type ? `[${m.type}]` : "");

          // Dedup gate: Meta redelivers the same m.id on retries. Skip anything
          // we've already stored so we don't re-increment unread or re-run the bot.
          if (m?.id) {
            const seen = await prisma.whatsappMessage.findUnique({ where: { waMessageId: m.id } });
            if (seen) continue;
          }

          const existing = await prisma.whatsappConversation.findUnique({
            where: { companyId_waPhone: { companyId: company.id, waPhone: from } },
          });
          const isNew = !existing;
          const convo = await prisma.whatsappConversation.upsert({
            where: { companyId_waPhone: { companyId: company.id, waPhone: from } },
            update: {
              lastMessageAt: new Date(),
              lastInboundAt: new Date(),
              unread: { increment: 1 },
              name: names.get(from) || undefined,
            },
            create: {
              companyId: company.id,
              waPhone: from,
              name: names.get(from) || null,
              lastInboundAt: new Date(),
              unread: 1,
            },
          });
          // The unique constraint on waMessageId is the race backstop: if a
          // concurrent redelivery beat us, the insert throws and we skip the bot.
          let freshlyStored = true;
          try {
            await prisma.whatsappMessage.create({
              data: {
                companyId: company.id,
                conversationId: convo.id,
                direction: "IN",
                waMessageId: m?.id ?? null,
                body: text,
                status: "received",
              },
            });
          } catch {
            freshlyStored = false;
          }

          // ── Conversational enquiry bot ── only on a genuinely new message
          if (freshlyStored && company.waBotEnabled && company.waPhoneNumberId && company.waAccessTokenEnc) {
            const c = { id: company.id, name: company.name, quotePrefix: company.quotePrefix, waPhoneNumberId: company.waPhoneNumberId, waAccessTokenEnc: company.waAccessTokenEnc };
            const cv = { id: convo.id, companyId: convo.companyId, waPhone: convo.waPhone, botStep: convo.botStep, botData: convo.botData };
            try {
              if (isNew && !convo.botActive) {
                await startBot(c, cv);
              } else if (convo.botActive) {
                await handleBotAnswer(c, cv, text);
              }
            } catch {
              // bot failure must not break the webhook
            }
          }
        }

        for (const st of value?.statuses ?? []) {
          if (st?.id && st?.status) {
            await prisma.whatsappMessage.updateMany({
              where: { waMessageId: st.id },
              data: { status: String(st.status) },
            });
          }
        }
      }
    }
  } catch {
    // Never fail the webhook — Meta would retry aggressively.
  }
  return new Response("ok", { status: 200 });
}
