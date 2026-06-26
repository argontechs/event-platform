import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

const GREEN = ["ACCEPTED", "PAID", "COMPLETED", "CONVERTED", "CONFIRMED", "active"];
const BLUE = ["SENT", "QUOTED", "IN_PLANNING", "READY", "PARTIAL"];
const AMBER = ["REVIEWING", "NEW", "ISSUED", "DEPOSIT"];
const RED = ["REJECTED", "LOST", "CANCELLED", "VOID", "disabled", "EXPIRED"];

function tone(status: string): string {
  const s = status.toUpperCase();
  if (GREEN.map((x) => x.toUpperCase()).includes(s)) return "bg-emerald-100 text-emerald-700";
  if (BLUE.map((x) => x.toUpperCase()).includes(s)) return "bg-blue-100 text-blue-700";
  if (AMBER.map((x) => x.toUpperCase()).includes(s)) return "bg-amber-100 text-amber-700";
  if (RED.map((x) => x.toUpperCase()).includes(s)) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

export async function StatusBadge({ status }: { status: string }) {
  const t = makeT(await getBoLang());
  const word = status.replace(/_/g, " ").toLowerCase();
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone(status)}`}>
      {t(word)}
    </span>
  );
}
