// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { rmSync } from "fs";
import { join } from "path";
import { saveUpload, UPLOAD_DIR } from "./storage";

// FV-20 — saveUpload must reject blank/forged Content-Types and derive a safe
// stored extension from the verified MIME (not the user's filename).
describe("FV-20 saveUpload MIME guard", () => {
  afterAll(() => {
    try { rmSync(join(UPLOAD_DIR, "fvtest"), { recursive: true, force: true }); } catch { /* noop */ }
  });

  it("rejects a blank Content-Type", async () => {
    expect(await saveUpload("fvtest", new File([new Uint8Array([1])], "evil.png", { type: "" }))).toBeNull();
  });

  it("rejects a disallowed type (svg)", async () => {
    expect(await saveUpload("fvtest", new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).toBeNull();
  });

  it("accepts a real image and forces the extension from the verified type", async () => {
    const r = await saveUpload("fvtest", new File([new Uint8Array([1])], "weird.html", { type: "image/png" }));
    expect(r).not.toBeNull();
    expect(r!.url).toMatch(/\.png$/); // ".png", never the user-supplied ".html"
  });
});
