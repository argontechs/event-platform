"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { sendWhatsappText } from "./client";
import type { SessionUser } from "../auth/session";

function canAccess(user: SessionUser, companyId: string): boolean {
  return isSuperAdmin(user) || user.companyId === companyId;
}

export type WaState = { error: string; ok?: boolean };

/** Staff replies in a conversation; sends via Cloud API and records the message. */
export async function sendWhatsappMessageAction(
  conversationId: string,
  _prev: WaState,
  formData: FormData,
): Promise<WaState> {
  const user = await requireSalesRole();
  const convo = await prisma.whatsappConversation.findUnique({
    where: { id: conversationId },
    include: { company: true },
  });
  if (!convo || !canAccess(user, convo.companyId)) return { error: "Not found." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message is empty." };

  const result = await sendWhatsappText(convo.company, convo.waPhone, body);

  await prisma.whatsappMessage.create({
    data: {
      companyId: convo.companyId,
      conversationId: convo.id,
      direction: "OUT",
      waMessageId: result.ok ? result.waMessageId : null,
      body,
      status: result.ok ? "sent" : "failed",
    },
  });
  await prisma.whatsappConversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: new Date(), botActive: false },
  });

  revalidatePath(`/admin/whatsapp/${conversationId}`);
  return result.ok ? { error: "", ok: true } : { error: result.error };
}

/** Staff takes over from the bot (stops auto-replies on this conversation). */
export async function takeOverConversationAction(conversationId: string, _formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const convo = await prisma.whatsappConversation.findUnique({ where: { id: conversationId } });
  if (!convo || !canAccess(user, convo.companyId)) return;
  await prisma.whatsappConversation.update({ where: { id: conversationId }, data: { botActive: false } });
  revalidatePath(`/admin/whatsapp/${conversationId}`);
}

/** Staff starts a new conversation by phone number. */
export async function startWhatsappConversationAction(formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const companyId = String(formData.get("companyId") ?? "");
  const phone = String(formData.get("phone") ?? "").replace(/[^0-9]/g, "");
  if (!companyId || !canAccess(user, companyId) || !phone) redirect("/admin/whatsapp");

  const convo = await prisma.whatsappConversation.upsert({
    where: { companyId_waPhone: { companyId, waPhone: phone } },
    update: {},
    create: { companyId, waPhone: phone },
  });
  redirect(`/admin/whatsapp/${convo.id}`);
}
