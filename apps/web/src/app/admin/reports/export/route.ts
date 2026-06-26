import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildGroupReport } from "@/lib/reports/group";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Guard against CSV formula injection: prefix cells that a spreadsheet would
  // evaluate (=, +, -, @, tab, CR) with a single quote, then quote/escape.
  const cell = (v: unknown): string => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const { rows, totals } = await buildGroupReport();
  const header = ["Company", "Leads", "Accepted", "Active events", "Upcoming", "Revenue", "Outstanding"];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((r) =>
      [r.name, r.leads, r.accepted, r.activeEvents, r.upcoming, r.revenue.toFixed(2), r.outstanding.toFixed(2)]
        .map(cell)
        .join(","),
    ),
    ["Total", totals.leads, totals.accepted, totals.activeEvents, totals.upcoming, totals.revenue.toFixed(2), totals.outstanding.toFixed(2)]
      .map(cell)
      .join(","),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="group-report.csv"',
    },
  });
}
