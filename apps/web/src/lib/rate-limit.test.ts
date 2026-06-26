import { describe, it, expect } from "vitest";
import { isRateLimited, recordFailure, clearAttempts } from "./rate-limit";

const OPTS = { max: 3, windowMs: 60_000, lockMs: 60_000 };

describe("rate limiter", () => {
  it("allows up to max failures, then locks out", () => {
    const key = "test:lock";
    clearAttempts(key);
    expect(isRateLimited(key, OPTS).limited).toBe(false);
    recordFailure(key, OPTS); // 1
    recordFailure(key, OPTS); // 2
    expect(isRateLimited(key, OPTS).limited).toBe(false);
    recordFailure(key, OPTS); // 3 → hits max, locks
    const gate = isRateLimited(key, OPTS);
    expect(gate.limited).toBe(true);
    expect(gate.retryAfterSec).toBeGreaterThan(0);
  });

  it("clears on success", () => {
    const key = "test:clear";
    recordFailure(key, OPTS);
    recordFailure(key, OPTS);
    recordFailure(key, OPTS);
    expect(isRateLimited(key, OPTS).limited).toBe(true);
    clearAttempts(key);
    expect(isRateLimited(key, OPTS).limited).toBe(false);
  });

  it("keeps keys independent", () => {
    clearAttempts("a");
    clearAttempts("b");
    recordFailure("a", OPTS);
    recordFailure("a", OPTS);
    recordFailure("a", OPTS);
    expect(isRateLimited("a", OPTS).limited).toBe(true);
    expect(isRateLimited("b", OPTS).limited).toBe(false);
  });
});
