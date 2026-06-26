import bcrypt from "bcryptjs";

const ROUNDS = 12;

// Precomputed once so the "no such user" login path still performs a real bcrypt
// comparison — removes the timing oracle that distinguishes existing accounts.
const DUMMY_HASH = bcrypt.hashSync("constant-work-placeholder", ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Burn equivalent bcrypt time when there is no user to compare against. */
export function dummyVerify(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
