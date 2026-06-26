import { rmSync } from "fs";
import { prisma } from "@event/db";
import { wipeFixtures, FIXTURES_PATH } from "./global-setup";

export default async function globalTeardown() {
  await wipeFixtures();
  await prisma.$disconnect();
  try { rmSync(FIXTURES_PATH); } catch { /* already gone */ }
}
