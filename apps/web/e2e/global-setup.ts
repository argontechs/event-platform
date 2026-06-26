// Seeds the public-quote fixtures the quote-flow spec needs, then writes their
// tokens to e2e/.fixtures.json. Runs once before the suite (see playwright.config.ts).
// All rows use the FVTEST- prefix so teardown can wipe them safely.
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "@event/db";

// 1x1 PNG used as the stored upload bytes for the upload-auth tests.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082",
  "hex",
);

export const FIXTURES_PATH = join(process.cwd(), "e2e", ".fixtures.json");
export const PIN = "654321";
export const TOKENS = {
  pinToken: "fvtest-pin",
  acceptToken: "fvtest-accept",
  acceptedToken: "fvtest-accepted",
  sentToken: "fvtest-sent",
  rejectedToken: "fvtest-rejected",
  expiredToken: "fvtest-expired",
};

export async function wipeFixtures() {
  const quotes = await prisma.quotation.findMany({ where: { number: { startsWith: "FVTEST-" } }, select: { id: true } });
  const ids = quotes.map((q) => q.id);
  if (ids.length) {
    await prisma.payment.deleteMany({ where: { booking: { quotationId: { in: ids } } } });
    await prisma.booking.deleteMany({ where: { quotationId: { in: ids } } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: ids } } });
    await prisma.quotation.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.attachment.deleteMany({ where: { filename: { startsWith: "fvtest-" } } });
  await prisma.customer.deleteMany({ where: { name: "FV Test Customer" } });
}

async function makeQuote(o: { company: string; customer: string; token: string; status: string; total: number; validUntil?: Date | null }) {
  const q = await prisma.quotation.create({
    data: {
      companyId: o.company, customerId: o.customer, number: `FVTEST-${o.token}`, status: o.status as never,
      publicToken: o.token, viewPin: PIN, subtotal: o.total, total: o.total, depositPercent: 50,
      depositAmount: o.total / 2, validUntil: o.validUntil ?? null, sentAt: new Date(),
    },
  });
  await prisma.quotationItem.create({
    data: { companyId: o.company, quotationId: q.id, description: "Backdrop package", category: "", quantity: 1, unit: "set", costPrice: o.total, profitPercent: 0, unitPrice: o.total, lineTotal: o.total, sortOrder: 0 },
  });
  return q;
}

export default async function globalSetup() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("No seeded company — run `npm run -w @event/db seed` first.");

  await wipeFixtures();
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: "FV Test Customer", phone: "60100000000", source: "test" } });
  const past = new Date(Date.now() - 86400000);

  await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.pinToken, status: "SENT", total: 1000 });
  await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.acceptToken, status: "SENT", total: 1000 });
  await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.sentToken, status: "SENT", total: 1000 });
  await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.rejectedToken, status: "REJECTED", total: 1000 });
  await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.expiredToken, status: "SENT", total: 1000, validUntil: past });
  const accepted = await makeQuote({ company: company.id, customer: customer.id, token: TOKENS.acceptedToken, status: "ACCEPTED", total: 1000 });
  await prisma.booking.create({ data: { companyId: company.id, quotationId: accepted.id, customerId: customer.id, title: "FV accepted", status: "CONFIRMED", totalAmount: 1000, depositPaid: 0, balanceDue: 1000 } });

  // Upload-auth fixtures: a private PAYMENT_PROOF and a public PORTFOLIO file.
  const dir = join(process.cwd(), "uploads", company.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "fvtest-proof.png"), PNG);
  writeFileSync(join(dir, "fvtest-portfolio.png"), PNG);
  const proofUrl = `/api/uploads/${company.id}/fvtest-proof.png`;
  const portfolioUrl = `/api/uploads/${company.id}/fvtest-portfolio.png`;
  await prisma.attachment.create({ data: { companyId: company.id, kind: "PAYMENT_PROOF", url: proofUrl, filename: "fvtest-proof.png", mimeType: "image/png", sizeBytes: PNG.length } });
  await prisma.attachment.create({ data: { companyId: company.id, kind: "PORTFOLIO", url: portfolioUrl, filename: "fvtest-portfolio.png", mimeType: "image/png", sizeBytes: PNG.length } });

  writeFileSync(FIXTURES_PATH, JSON.stringify({ pin: PIN, ...TOKENS, proofUrl, portfolioUrl }, null, 2));
  await prisma.$disconnect();
}
