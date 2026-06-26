import { randomBytes } from "crypto";
import { prisma } from "@event/db";
import { sendWhatsappText, type WaCompany } from "./client";

// The conversational enquiry flow. Each step stores the answer under `key`,
// then asks the next prompt. After the last step a Lead is created.
const QUESTIONS: { key: string; prompt: string }[] = [
  { key: "name", prompt: "Hi! 👋 Welcome to {company}. I'll help prepare a quote for your event. May I have your name?\n您好！欢迎光临，请问您的名字？" },
  { key: "eventType", prompt: "Nice to meet you, {name}! What type of event is it? (Wedding / Birthday / Corporate / Engagement / Other)\n请问是什么活动？(婚礼/生日/公司/订婚/其他)" },
  { key: "eventDate", prompt: "What's the event date? e.g. 2026-12-25\n活动日期？例如 2026-12-25" },
  { key: "venue", prompt: "Where will it be held (venue / area)?\n地点在哪里？" },
  { key: "guests", prompt: "Roughly how many guests?\n大概多少位宾客？" },
  { key: "budget", prompt: "What's your budget range in RM?\n您的预算范围 (RM)？" },
  { key: "details", prompt: "Any theme, colours or special requests?\n有什么主题、颜色或特别要求吗？" },
];

const HANDOFF = /\b(agent|human|staff|person|talk to|representative)\b|人工|客服|真人/i;

type Company = WaCompany & { id: string; name: string; quotePrefix: string };
type Convo = { id: string; companyId: string; waPhone: string; botStep: number; botData: unknown };

function fill(prompt: string, data: Record<string, string>): string {
  return prompt.replace("{company}", data.company ?? "us").replace("{name}", data.name ?? "");
}

function mapEventType(text: string): string {
  const t = text.toLowerCase();
  if (/wed|婚/.test(t)) return "WEDDING";
  if (/birth|生日/.test(t)) return "BIRTHDAY";
  if (/corp|company|公司/.test(t)) return "CORPORATE";
  if (/engag|订婚/.test(t)) return "ENGAGEMENT";
  if (/festiv|节/.test(t)) return "FESTIVAL";
  if (/launch|发布/.test(t)) return "PRODUCT_LAUNCH";
  return "OTHER";
}

async function sendBotMessage(company: Company, convo: Convo, body: string) {
  const res = await sendWhatsappText(company, convo.waPhone, body);
  await prisma.whatsappMessage.create({
    data: {
      companyId: convo.companyId,
      conversationId: convo.id,
      direction: "OUT",
      waMessageId: res.ok ? res.waMessageId : null,
      body,
      status: res.ok ? "sent" : "failed",
    },
  });
  await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date() } });
}

/** Begin the enquiry flow on a fresh conversation. */
export async function startBot(company: Company, convo: Convo) {
  await prisma.whatsappConversation.update({
    where: { id: convo.id },
    data: { botActive: true, botStep: 0, botData: { company: company.name } },
  });
  await sendBotMessage(company, convo, fill(QUESTIONS[0].prompt, { company: company.name }));
}

/** Process an inbound answer, ask the next question, or finalise into a Lead. */
export async function handleBotAnswer(company: Company, convo: Convo, text: string) {
  if (HANDOFF.test(text)) {
    await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { botActive: false } });
    await sendBotMessage(company, convo, "No problem — I'll connect you with our team. They'll reply here shortly. 🙏\n好的，我们的团队会尽快回复您。");
    if (company.id) {
      const c = await prisma.company.findUnique({ where: { id: company.id }, select: { email: true } });
      if (c?.email) {
        await prisma.emailLog.create({ data: { companyId: company.id, to: c.email, subject: "WhatsApp: customer asked for a human", template: "staff_new_lead", status: "queued" } }).catch(() => undefined);
      }
    }
    return;
  }

  const step = convo.botStep;
  // Bounds-guard before dereferencing QUESTIONS[step]: an out-of-range step
  // (interleaved answers / already-finalised flow) would otherwise throw.
  if (step < 0 || step >= QUESTIONS.length) {
    await prisma.whatsappConversation
      .update({ where: { id: convo.id }, data: { botActive: false } })
      .catch(() => undefined);
    return;
  }
  const data = (typeof convo.botData === "object" && convo.botData ? convo.botData : {}) as Record<string, string>;
  data[QUESTIONS[step].key] = text.trim();
  const nextStep = step + 1;

  if (nextStep < QUESTIONS.length) {
    await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { botStep: nextStep, botData: data } });
    await sendBotMessage(company, { ...convo, botStep: nextStep }, fill(QUESTIONS[nextStep].prompt, data));
    return;
  }

  // Finalise → create customer + lead.
  await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { botActive: false, botStep: nextStep, botData: data } });
  const customer = await prisma.customer.create({
    data: { companyId: company.id, name: data.name || "WhatsApp lead", phone: convo.waPhone, source: "whatsapp" },
  });
  const code = (company.quotePrefix || "PE").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "PE";
  const refNo = `${code}-EVT-${new Date().getUTCFullYear()}-${parseInt(randomBytes(3).toString("hex"), 16) % 10000}`;
  const eventDate = !isNaN(Date.parse(data.eventDate)) ? new Date(data.eventDate) : null;
  const guests = parseInt(String(data.guests).replace(/[^0-9]/g, ""), 10);

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: customer.id,
      referenceNo: refNo,
      eventType: mapEventType(data.eventType || "") as never,
      eventDate,
      venueText: data.venue || null,
      guestCount: Number.isFinite(guests) ? guests : null,
      theme: data.details || null,
      specialRequest: data.budget ? `Budget: ${data.budget}` : null,
      message: "Captured via WhatsApp bot",
      preferredLanguage: "EN",
      status: "NEW",
    },
  }).catch(() => null);

  await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { customerId: customer.id } }).catch(() => undefined);

  await sendBotMessage(company, convo, `Thank you, ${data.name || "there"}! 🎉 We've got your details (ref ${refNo}). Our team will prepare a proposal and reply here soon.\n谢谢！我们已收到您的资料，团队会尽快为您准备方案。`);

  const c = await prisma.company.findUnique({ where: { id: company.id }, select: { email: true } });
  if (c?.email && lead) {
    await prisma.emailLog.create({ data: { companyId: company.id, to: c.email, subject: `New WhatsApp enquiry ${refNo}`, template: "staff_new_lead", status: "queued" } }).catch(() => undefined);
  }
}
