"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin, canManageCompany } from "../auth/rbac";
import { getActiveCompanyId } from "../tenant";
import { saveUpload } from "../storage";
import type { SessionUser } from "../auth/session";

function canAccess(user: SessionUser, companyId: string): boolean {
  return isSuperAdmin(user) || user.companyId === companyId;
}
async function resolveCompanyId(user: SessionUser): Promise<string | null> {
  return isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;
}
function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

export type PettyCashState = { error: string };

// ── Top-up (cash IN) — managers only, auto-approved ──
export async function addTopupAction(_prev: PettyCashState, fd: FormData): Promise<PettyCashState> {
  const user = await requireUser();
  if (!canManageCompany(user)) return { error: "Only managers can add cash to the float." };
  const companyId = await resolveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };
  const amountRaw = Number(fd.get("amount"));
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  if (amount <= 0) return { error: "Enter the amount added." };
  const dateStr = str(fd, "entryDate");
  await prisma.pettyCashEntry.create({
    data: {
      companyId,
      type: "TOPUP",
      entryDate: dateStr ? new Date(dateStr) : new Date(),
      payTo: str(fd, "payTo") || null,
      description: str(fd, "description") || "Reimbursement / top-up",
      amount,
      status: "APPROVED",
      submittedById: user.id,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });
  revalidatePath("/admin/petty-cash");
  revalidatePath("/admin/finance");
  return { error: "" };
}

// ── Spend (cash OUT) — any staff; needs approval ──
export async function addSpendAction(_prev: PettyCashState, fd: FormData): Promise<PettyCashState> {
  const user = await requireUser();
  const companyId = await resolveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };
  const amountRaw = Number(fd.get("amount"));
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  if (amount <= 0) return { error: "Enter the amount spent." };
  const description = str(fd, "description");
  if (!description) return { error: "Describe what it was for." };
  const dateStr = str(fd, "entryDate");

  const entry = await prisma.pettyCashEntry.create({
    data: {
      companyId,
      type: "SPEND",
      entryDate: dateStr ? new Date(dateStr) : new Date(),
      voucherNo: str(fd, "voucherNo") || null,
      payTo: str(fd, "payTo") || null,
      description,
      category: str(fd, "category") || null,
      amount,
      status: "PENDING",
      submittedById: user.id,
    },
  });

  const files = fd.getAll("receipts").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files.slice(0, 6)) {
    const stored = await saveUpload(companyId, file);
    if (stored) {
      await prisma.attachment.create({
        data: {
          companyId,
          kind: "RECEIPT",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          pettyCashId: entry.id,
          uploadedById: user.id,
        },
      });
    }
  }
  revalidatePath("/admin/petty-cash");
  return { error: "" };
}

// ── Approve / reject (managers) ──
async function setStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<void> {
  const user = await requireUser();
  if (!canManageCompany(user)) return;
  const e = await prisma.pettyCashEntry.findUnique({ where: { id } });
  if (!e || !canAccess(user, e.companyId)) return;
  if (e.status !== "PENDING") return; // only a pending entry can be approved/rejected

  try {
    // Serializable so the read-balance + approve can't interleave with another
    // concurrent approval and overdraw the float (TOCTOU). A serialization
    // conflict aborts safely — the entry just stays PENDING.
    await prisma.$transaction(
      async (tx) => {
        // Approving a SPEND must not drive the float negative.
        if (status === "APPROVED" && e.type === "SPEND") {
          const agg = await tx.pettyCashEntry.groupBy({
            by: ["type"],
            where: { companyId: e.companyId, status: "APPROVED" },
            _sum: { amount: true },
          });
          const sum = (t: string) => Number(agg.find((a) => a.type === t)?._sum.amount ?? 0);
          const balance = sum("TOPUP") - sum("SPEND");
          if (Number(e.amount) > balance) return; // insufficient float — leave PENDING
        }
        // Conditional WHERE doubles as the lock against a concurrent second approve.
        await tx.pettyCashEntry.updateMany({
          where: { id, status: "PENDING" },
          data: { status: status as never, approvedById: user.id, approvedAt: new Date() },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    // serialization failure / write conflict — safe no-op (stays PENDING)
  }

  revalidatePath("/admin/petty-cash");
  revalidatePath("/admin/finance");
}
export async function approvePettyAction(id: string, _fd: FormData): Promise<void> {
  await setStatus(id, "APPROVED");
}
export async function rejectPettyAction(id: string, _fd: FormData): Promise<void> {
  await setStatus(id, "REJECTED");
}
export async function deletePettyAction(id: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  if (!canManageCompany(user)) return;
  const e = await prisma.pettyCashEntry.findUnique({ where: { id } });
  if (!e || !canAccess(user, e.companyId)) return;
  await prisma.pettyCashEntry.delete({ where: { id } });
  revalidatePath("/admin/petty-cash");
  revalidatePath("/admin/finance");
}
