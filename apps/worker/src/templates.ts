const BODIES: Record<string, string> = {
  enquiry_confirmation:
    "Thank you for your enquiry. Our team will review your event and prepare a tailored proposal shortly.",
  staff_new_lead: "A new enquiry has been submitted. Please review it in the back office.",
  quotation_sent: "Your quotation is ready. Please review and accept it online.",
  payment_proof_received: "A customer has uploaded payment proof. Please confirm it in the back office.",
  invoice_issued: "Your invoice is attached/available. Thank you for your payment.",
  balance_reminder: "This is a friendly reminder that your event balance is due soon.",
  feedback_request: "Thank you for choosing us! We'd love to hear your feedback on your event.",
};

// Subject is built from user-controlled text (booking title, company name), so
// escape it before interpolating into HTML — otherwise markup in a title/name
// renders live in the recipient's inbox.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(template: string | null, subject: string): string {
  const body = (template && BODIES[template]) || "";
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
  <h2 style="color:#0b0b10">${escapeHtml(subject)}</h2>
  <p style="color:#444;line-height:1.6">${body}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">Sent by the Event &amp; Decoration platform.</p>
</div>`;
}
