import pino from "pino";
import { processQueuedEmails, runReminders, runStatusSweep } from "./jobs";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "worker" },
});

const EMAIL_INTERVAL = Number(process.env.WORKER_EMAIL_INTERVAL_MS ?? 15_000);
const SWEEP_INTERVAL = Number(process.env.WORKER_SWEEP_INTERVAL_MS ?? 60 * 60 * 1000);

// Re-entrancy guards: a tick that runs longer than its interval must not be
// re-entered by the next timer fire (which would pile up concurrent work).
let emailBusy = false;
let sweepBusy = false;

async function emailTick(): Promise<void> {
  if (emailBusy) return;
  emailBusy = true;
  try {
    const n = await processQueuedEmails();
    if (n > 0) logger.info({ processed: n }, "emails processed");
  } catch (err) {
    logger.error({ err }, "email tick failed");
  } finally {
    emailBusy = false;
  }
}

async function sweepTick(): Promise<void> {
  if (sweepBusy) return;
  sweepBusy = true;
  try {
    const reminders = await runReminders();
    const executed = await runStatusSweep();
    if (reminders > 0 || executed > 0) {
      logger.info({ reminders, executed }, "sweep complete");
    }
  } catch (err) {
    logger.error({ err }, "sweep tick failed");
  } finally {
    sweepBusy = false;
  }
}

async function main(): Promise<void> {
  logger.info(
    { EMAIL_INTERVAL, SWEEP_INTERVAL },
    "worker started — polling Postgres for queued emails + reminders",
  );
  await emailTick();
  await sweepTick();
  setInterval(() => void emailTick(), EMAIL_INTERVAL);
  setInterval(() => void sweepTick(), SWEEP_INTERVAL);
}

main().catch((err) => {
  logger.error({ err }, "worker crashed");
  process.exit(1);
});
