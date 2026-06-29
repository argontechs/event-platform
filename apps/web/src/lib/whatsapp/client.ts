import { decryptSecret } from "../crypto";

// Meta WhatsApp Cloud API. Override the version/host via env if needed.
const GRAPH = process.env.WHATSAPP_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

export type WaCompany = {
  waPhoneNumberId: string | null;
  waAccessTokenEnc: string | null;
};

export type WaSendResult =
  | { ok: true; waMessageId: string | null }
  | { ok: false; error: string };

/** Send a plain-text WhatsApp message via the company's Cloud API number. */
export async function sendWhatsappText(
  company: WaCompany,
  toPhone: string,
  body: string,
): Promise<WaSendResult> {
  const phoneNumberId = company.waPhoneNumberId;
  const token = decryptSecret(company.waAccessTokenEnc);
  if (!phoneNumberId || !token) {
    return { ok: false, error: "WhatsApp is not configured for this company." };
  }
  // Meta rejects an empty text body — guard all callers (bot + staff inbox).
  if (!body || !body.trim()) {
    return { ok: false, error: "Empty message body." };
  }

  // Normalise + validate the destination to E.164 digits. The inbound webhook
  // path stores `m.from` verbatim, so never trust it to be a clean number.
  const to = toPhone.replace(/[^\d]/g, "");
  if (!/^\d{8,15}$/.test(to)) {
    return { ok: false, error: "Invalid recipient phone number." };
  }

  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `Send failed (${res.status})` };
    }
    return { ok: true, waMessageId: data?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
