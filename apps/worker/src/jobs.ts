import { prisma } from "@event/db";
import { sendEmail } from "./email";
import { renderEmail } from "./templates";

const DAY = 24 * 60 * 60 * 1000;

/** Send any queued emails that have a real recipient. */
export async function processQueuedEmails(): Promise<number> {
  const queued = await prisma.emailLog.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let processed = 0;
  for (const e of queued) {
    // Atomically claim the row before the slow SMTP send. Only the tick/worker
    // that flips queued→sending proceeds, so an overlapping tick (or a second
    // worker) can never send the same email twice.
    const claim = await prisma.emailLog.updateMany({
      where: { id: e.id, status: "queued" },
      data: { status: "sending" },
    });
    if (claim.count === 0) continue;

    if (!e.to.includes("@")) {
      await prisma.emailLog.update({ where: { id: e.id }, data: { status: "skipped" } });
      continue;
    }
    try {
      const result = await sendEmail({
        to: e.to,
        subject: e.subject,
        html: renderEmail(e.template, e.subject),
      });
      await prisma.emailLog.update({ where: { id: e.id }, data: { status: result } });
      processed++;
    } catch (err) {
      await prisma.emailLog.update({
        where: { id: e.id },
        data: { status: "failed", error: String(err).slice(0, 300) },
      });
    }
  }
  return processed;
}

/** Queue balance-due reminders for events happening within 7 days. */
export async function runReminders(): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * DAY);
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["IN_PLANNING", "READY"] },
      balanceDue: { gt: 0 },
      eventDate: { gte: now, lte: soon },
    },
    include: { customer: true },
  });

  let queued = 0;
  for (const b of bookings) {
    if (!b.customer?.email) continue;
    const recent = await prisma.emailLog.findFirst({
      where: {
        companyId: b.companyId,
        template: "balance_reminder",
        to: b.customer.email,
        createdAt: { gte: new Date(now.getTime() - 3 * DAY) },
      },
    });
    if (recent) continue;
    await prisma.emailLog.create({
      data: {
        companyId: b.companyId,
        to: b.customer.email,
        subject: `Balance reminder — ${b.title}`,
        template: "balance_reminder",
        status: "queued",
      },
    });
    queued++;
  }
  return queued;
}

/** Move past-date events that are still in planning into EXECUTED. */
export async function runStatusSweep(): Promise<number> {
  const res = await prisma.booking.updateMany({
    where: { eventDate: { lt: new Date() }, status: { in: ["IN_PLANNING", "READY"] } },
    data: { status: "EXECUTED" },
  });
  return res.count;
}
