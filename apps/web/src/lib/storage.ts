import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

/**
 * File storage. Local-disk implementation now (self-hosted volume friendly);
 * swap for MinIO/S3 in the final infra step by changing this module only.
 * Served back via /api/uploads/[...path].
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per file
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type StoredFile = {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
};

const EXT_FOR: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function safeName(name: string): string {
  // strip any extension; the stored extension is derived from the verified MIME
  return name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

export async function saveUpload(
  companyId: string,
  file: File,
): Promise<StoredFile | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) return null;
  // Reject a missing/blank Content-Type too — the previous `file.type && …`
  // short-circuit let an attacker bypass the allowlist by omitting the type.
  if (!file.type || !ALLOWED.includes(file.type)) return null;

  const dir = join(UPLOAD_DIR, companyId);
  await mkdir(dir, { recursive: true });

  // Stored extension comes from the verified MIME, never the user's filename,
  // so a `.svg`/`.html` name can't survive onto disk.
  const ext = EXT_FOR[file.type] ?? "bin";
  const stored = `${randomBytes(8).toString("hex")}-${safeName(file.name)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, stored), buf);

  return {
    url: `/api/uploads/${companyId}/${stored}`,
    filename: file.name || stored,
    mimeType: file.type,
    size: buf.length,
  };
}

/** Save raw bytes (e.g. an AI-generated image) the same way as an upload. */
export async function saveBuffer(
  companyId: string,
  buf: Buffer,
  mimeType: string,
  name: string,
): Promise<StoredFile> {
  const dir = join(UPLOAD_DIR, companyId);
  await mkdir(dir, { recursive: true });
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const stored = `${randomBytes(8).toString("hex")}-${safeName(name)}.${ext}`;
  await writeFile(join(dir, stored), buf);
  return {
    url: `/api/uploads/${companyId}/${stored}`,
    filename: name,
    mimeType,
    size: buf.length,
  };
}

/** Read a stored upload back as a base64 data URL (for sending to the AI). */
export async function readUploadAsDataUrl(url: string): Promise<string | null> {
  const prefix = "/api/uploads/";
  if (!url.startsWith(prefix)) return null;
  const rel = url.slice(prefix.length);
  if (rel.includes("..")) return null;
  try {
    const data = await readFile(join(UPLOAD_DIR, rel));
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Read a stored upload back as raw bytes + mime (for image-to-image edits). */
export async function readUploadBytes(
  url: string,
): Promise<{ buf: Buffer; mime: string } | null> {
  const prefix = "/api/uploads/";
  if (!url.startsWith(prefix)) return null;
  const rel = url.slice(prefix.length);
  if (rel.includes("..")) return null;
  try {
    const buf = await readFile(join(UPLOAD_DIR, rel));
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return { buf, mime };
  } catch {
    return null;
  }
}
