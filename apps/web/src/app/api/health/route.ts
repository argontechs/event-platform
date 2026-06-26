import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export function GET() {
  logger.info({ route: "/api/health" }, "health check");
  return NextResponse.json({
    status: "ok",
    service: "web",
    phase: 0,
    time: new Date().toISOString(),
  });
}
