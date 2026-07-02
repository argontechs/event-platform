import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join, normalize, isAbsolute } from "path";
import { prisma } from "@event/db";
import { UPLOAD_DIR } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Sensitive artifacts that must NEVER be world-readable. Public assets
// (PORTFOLIO/PACKAGE on the marketing site, branding logos/QR, proposal
// moodboards on the token-gated quote page) stay servable without a session.
const PRIVATE_KINDS = new Set(["PAYMENT_PROOF", "RECEIPT"]);

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

// Serves files saved by lib/storage.ts (local-disk volume).
// Guards against path traversal: rejects "..", absolute paths, and anything
// that resolves outside UPLOAD_DIR.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const rel = (path ?? []).join("/");

  if (!rel || rel.includes("..") || rel.includes("\0") || isAbsolute(rel)) {
    return new Response("Bad request", { status: 400 });
  }

  const base = normalize(UPLOAD_DIR);
  const full = normalize(join(base, rel));
  if (full !== base && !full.startsWith(base + "/")) {
    return new Response("Forbidden", { status: 403 });
  }

  // Authorize access — FAIL CLOSED. A file is served without a session only when
  // it is provably public: a PORTFOLIO/PACKAGE/etc. Attachment, or a company
  // branding asset (logo / DuitNow QR / OG image). Private kinds (payment proof,
  // receipt) AND anything we can't positively identify as public (orphaned /
  // cascade-deleted / case-mismatched files) require a staff session of the
  // owning company. Filename randomness is not an access control.
  const url = `/api/uploads/${rel}`;
  const att = await prisma.attachment.findFirst({
    where: { url },
    select: { kind: true, companyId: true },
  });
  let needAuth: boolean;
  let ownerCompanyId: string | null;
  if (att) {
    needAuth = PRIVATE_KINDS.has(att.kind);
    ownerCompanyId = att.companyId;
  } else {
    const branded = await prisma.company.findFirst({
      where: { OR: [{ logoUrl: url }, { duitnowQrUrl: url }, { ogImageUrl: url }] },
      select: { id: true },
    });
    needAuth = !branded; // unknown/orphaned → private by default
    ownerCompanyId = path[0] ?? null; // first segment is the companyId directory
  }
  if (needAuth) {
    const user = await getSession();
    if (!user || (user.role !== "SUPER_ADMIN" && (!ownerCompanyId || user.companyId !== ownerCompanyId))) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let data: Buffer;
  try {
    data = await readFile(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Never let the browser sniff a different type (defends against an
      // image-typed file whose bytes are actually HTML/SVG).
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
