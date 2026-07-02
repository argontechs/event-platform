import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import {
  updateEventAction,
  addTaskAction,
  toggleTaskAction,
  deleteTaskAction,
  addRunSheetAction,
  deleteRunSheetAction,
  addSupplierToEventAction,
  removeSupplierFromEventAction,
  addCrewToEventAction,
  removeCrewFromEventAction,
  addPrepItemAction,
  togglePrepItemAction,
  deletePrepItemAction,
  loadPrepTemplateAction,
} from "@/lib/planning/actions";
import { EventForm, type EventValues } from "@/components/planning/event-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

const field =
  "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

export default async function EventBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = makeT(await getBoLang());
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      location: true,
      customer: true,
      tasks: { orderBy: { sortOrder: "asc" } },
      runSheet: { orderBy: { sortOrder: "asc" } },
      suppliers: { include: { supplier: true } },
      crew: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      prepItems: { orderBy: { sortOrder: "asc" } },
      quotation: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      payments: true,
      invoices: true,
    },
  });
  if (!booking) notFound();
  if (!isSuperAdmin(user) && user.companyId !== booking.companyId) redirect("/planning");

  const locations = await prisma.location.findMany({
    where: { companyId: booking.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const staff = await prisma.user.findMany({
    where: { companyId: booking.companyId, status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  const setupCrew = booking.crew.filter((c) => c.phase === "SETUP" || c.phase === "BOTH");
  const dismantleCrew = booking.crew.filter((c) => c.phase === "DISMANTLE" || c.phase === "BOTH");
  const prepMaterials = booking.prepItems.filter((p) => p.kind === "MATERIAL");
  const prepOperations = booking.prepItems.filter((p) => p.kind === "OPERATION");

  const supplierCost = booking.suppliers.reduce((sum, s) => sum + Number(s.cost ?? 0), 0);
  const total = Number(booking.totalAmount);
  const margin = total - supplierCost;
  const doneTasks = booking.tasks.filter((t) => t.status === "DONE").length;

  // Materials needed for planning — read from the linked quotation, unlocked
  // once the customer has paid (a confirmed payment, a deposit, or a part/fully
  // paid invoice).
  const materials = booking.quotation?.items ?? [];
  const paid =
    booking.payments.some((p) => p.status === "CONFIRMED") ||
    Number(booking.depositPaid) > 0 ||
    booking.invoices.some(
      (i) => i.status === "PAID" || i.status === "PARTIAL" || Number(i.amountPaid) > 0,
    );

  const values: EventValues = {
    title: booking.title,
    eventType: booking.eventType,
    eventDate: booking.eventDate ? booking.eventDate.toISOString().slice(0, 10) : "",
    locationId: booking.locationId ?? "",
    venueText: booking.venueText ?? "",
    totalAmount: String(total),
    status: booking.status,
  };

  return (
    <section className="max-w-5xl">
      <Link href="/planning" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t("Planning")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{booking.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {booking.status.replace("_", " ").toLowerCase()} ·{" "}
        {booking.eventDate ? booking.eventDate.toISOString().slice(0, 10) : t("date TBC")}
        {booking.location ? ` · ${booking.location.name}` : ""}
      </p>

      {/* Budget */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label={t("Event value")} value={rm(total)} />
        <Stat label={t("Supplier cost")} value={rm(supplierCost)} />
        <Stat label={t("Margin")} value={rm(margin)} />
      </div>

      {/* Materials to prepare — unlocked once the customer has paid */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("Materials to prepare")}
            {materials.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-slate-400">({materials.length})</span>
            ) : null}
            {paid && materials.length > 0 ? (
              <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                {t("Paid")}
              </span>
            ) : null}
          </h2>
          {booking.quotation ? (
            <Link
              href={`/admin/quotations/${booking.quotation.id}`}
              className="text-xs text-accent hover:underline"
            >
              {t("Open quotation")} →
            </Link>
          ) : null}
        </div>

        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            {t("No quotation is linked to this booking yet.")}
          </p>
        ) : !paid ? (
          <p className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            🔒 {t("The materials list unlocks once the customer has paid (deposit received).")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t("Material / item")}</th>
                  <th className="w-20 px-3 py-2 text-right">{t("Qty")}</th>
                  <th className="w-24 px-3 py-2">{t("Unit")}</th>
                  <th className="px-3 py-2">{t("Category")}</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{it.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{Number(it.quantity)}</td>
                    <td className="px-3 py-2 text-slate-600">{it.unit}</td>
                    <td className="px-3 py-2 text-slate-500">{it.category || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Tasks */}
        <div>
          <h2 className="text-lg font-semibold">
            {t("Checklist")} <span className="text-sm font-normal text-slate-400">({doneTasks}/{booking.tasks.length})</span>
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {booking.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <form action={toggleTaskAction.bind(null, task.id)}>
                  <button
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      task.status === "DONE" ? "border-accent bg-accent text-white" : "border-slate-300 text-transparent"
                    }`}
                    aria-label={t("Toggle task")}
                  >
                    ✓
                  </button>
                </form>
                <span className={`flex-1 ${task.status === "DONE" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {task.title}
                  {task.category ? <span className="ml-2 text-xs text-slate-400">{task.category}</span> : null}
                </span>
                <form action={deleteTaskAction.bind(null, task.id)}>
                  <ConfirmSubmit
                    label="✕"
                    ariaLabel={t("Delete task")}
                    title={t("Delete this task?")}
                    confirmLabel={t("Delete")}
                    buttonClassName="text-slate-400 hover:text-red-400"
                  />
                </form>
              </div>
            ))}
          </div>
          <form action={addTaskAction.bind(null, booking.id)} className="mt-3 flex flex-wrap gap-2">
            <input name="title" placeholder={t("New task")} className={`${field} flex-1`} />
            <input name="category" placeholder={t("Category")} className={`${field} w-28`} />
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">{t("Add")}</button>
          </form>
        </div>

        {/* Run sheet */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("Run sheet")}</h2>
            <Link href={`/planning/${booking.id}/runsheet`} className="text-xs text-accent hover:underline">
              🖨 {t("Print run sheet")}
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {booking.runSheet.length === 0 ? (
              <p className="text-sm text-slate-400">{t("No entries yet.")}</p>
            ) : (
              booking.runSheet.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="w-14 text-slate-500">{r.time ?? "—"}</span>
                  <span className="flex-1 text-slate-900">{r.activity}</span>
                  {r.owner ? <span className="text-slate-400">{r.owner}</span> : null}
                  <form action={deleteRunSheetAction.bind(null, r.id)}>
                    <ConfirmSubmit
                      label="✕"
                      ariaLabel={t("Delete entry")}
                      title={t("Delete this entry?")}
                      confirmLabel={t("Delete")}
                      buttonClassName="text-slate-400 hover:text-red-500"
                    />
                  </form>
                </div>
              ))
            )}
          </div>
          <form action={addRunSheetAction.bind(null, booking.id)} className="mt-3 flex flex-wrap gap-2">
            <input name="time" placeholder="14:30" className={`${field} w-20`} />
            <input name="activity" placeholder={t("Activity")} className={`${field} flex-1`} />
            <input name="owner" placeholder={t("Owner")} className={`${field} w-24`} />
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">{t("Add")}</button>
          </form>
        </div>

        {/* Suppliers */}
        <div>
          <h2 className="text-lg font-semibold">{t("Suppliers")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {booking.suppliers.length === 0 ? (
              <p className="text-sm text-slate-400">{t("None assigned.")}</p>
            ) : (
              booking.suppliers.map((bs) => (
                <div key={bs.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-900">
                    {bs.supplier.name}
                    {bs.supplier.type ? <span className="ml-2 text-xs text-slate-400">{bs.supplier.type}</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-slate-600">{rm(Number(bs.cost ?? 0))}</span>
                    <form action={removeSupplierFromEventAction.bind(null, bs.id)}>
                      <ConfirmSubmit
                        label="✕"
                        ariaLabel={t("Remove supplier")}
                        title={t("Remove this supplier from the event?")}
                        confirmLabel={t("Remove")}
                        buttonClassName="text-slate-400 hover:text-red-500"
                      />
                    </form>
                  </span>
                </div>
              ))
            )}
          </div>
          <form action={addSupplierToEventAction.bind(null, booking.id)} className="mt-3 grid grid-cols-2 gap-2">
            <input name="name" placeholder={t("Supplier name")} className={field} />
            <input name="type" placeholder={t("Type (florist…)")} className={field} />
            <input name="cost" type="number" step="0.01" placeholder={t("Cost (RM)")} className={field} />
            <input name="phone" placeholder={t("Phone")} className={field} />
            <button className="col-span-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">
              {t("Add supplier")}
            </button>
          </form>
        </div>

        {/* Setup & dismantle crew */}
        <div>
          <h2 className="text-lg font-semibold">{t("Setup & dismantle crew")}</h2>
          <p className="text-xs text-slate-400">{t("Assign staff (or a name) to set up and tear down the event.")}</p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <CrewColumn
              title={t("Setup")}
              tone="blue"
              empty={t("No one assigned.")}
              members={setupCrew.map((c) => ({
                id: c.id,
                name: c.user?.name ?? c.name ?? "—",
                role: c.role,
                phone: c.phone,
                both: c.phase === "BOTH",
                bothLabel: t("both"),
              }))}
              removeLabel={t("Remove")}
              confirmTitle={t("Remove this crew member?")}
            />
            <CrewColumn
              title={t("Dismantle")}
              tone="amber"
              empty={t("No one assigned.")}
              members={dismantleCrew.map((c) => ({
                id: c.id,
                name: c.user?.name ?? c.name ?? "—",
                role: c.role,
                phone: c.phone,
                both: c.phase === "BOTH",
                bothLabel: t("both"),
              }))}
              removeLabel={t("Remove")}
              confirmTitle={t("Remove this crew member?")}
            />
          </div>

          <form action={addCrewToEventAction.bind(null, booking.id)} className="mt-3 grid grid-cols-2 gap-2">
            <select name="userId" className={`${field} [&_option]:text-slate-900`} defaultValue="">
              <option value="">{t("— staff member —")}</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role.toLowerCase()})
                </option>
              ))}
            </select>
            <select name="phase" className={`${field} [&_option]:text-slate-900`} defaultValue="SETUP">
              <option value="SETUP">{t("Setup")}</option>
              <option value="DISMANTLE">{t("Dismantle")}</option>
              <option value="BOTH">{t("Both")}</option>
            </select>
            <input name="name" placeholder={t("…or type a name")} className={field} />
            <input name="role" placeholder={t("Role (lead, driver…)")} className={field} />
            <input name="phone" placeholder={t("Phone")} className={field} />
            <button className="col-span-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">
              {t("Add crew")}
            </button>
          </form>
        </div>

        {/* Preparation / loading list */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{t("Preparation / loading list")}</h2>
              <p className="text-xs text-slate-400">{t("What to load & do on site. Tick items as you pack.")}</p>
            </div>
            {booking.prepItems.length === 0 ? (
              <form action={loadPrepTemplateAction.bind(null, booking.id)}>
                <button className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/20">
                  {t("Load standard template")}
                </button>
              </form>
            ) : null}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <PrepColumn
              title={t("Materials")}
              kind="MATERIAL"
              items={prepMaterials}
              bookingId={booking.id}
              t={t}
            />
            <PrepColumn
              title={t("Operations")}
              kind="OPERATION"
              items={prepOperations}
              bookingId={booking.id}
              t={t}
            />
          </div>
        </div>

        {/* Event details */}
        <div>
          <h2 className="text-lg font-semibold">{t("Event details")}</h2>
          <div className="mt-3">
            <EventForm
              action={updateEventAction.bind(null, booking.id)}
              locations={locations}
              initial={values}
              submitLabel={t("Save details")}
              showStatus
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CrewColumn({
  title,
  tone,
  empty,
  members,
  removeLabel,
  confirmTitle,
}: {
  title: string;
  tone: "blue" | "amber";
  empty: string;
  members: {
    id: string;
    name: string;
    role: string | null;
    phone: string | null;
    both: boolean;
    bothLabel: string;
  }[];
  removeLabel: string;
  confirmTitle: string;
}) {
  const dot = tone === "blue" ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
        <span className="text-xs font-normal text-slate-400">({members.length})</span>
      </p>
      {members.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-900">
                {m.name}
                {m.role ? <span className="ml-1 text-xs text-slate-400">· {m.role}</span> : null}
                {m.both ? (
                  <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{m.bothLabel}</span>
                ) : null}
                {m.phone ? <span className="ml-1 text-xs text-slate-400">{m.phone}</span> : null}
              </span>
              <form action={removeCrewFromEventAction.bind(null, m.id)}>
                <ConfirmSubmit
                  label="✕"
                  ariaLabel={removeLabel}
                  title={confirmTitle}
                  confirmLabel={removeLabel}
                  buttonClassName="text-slate-400 hover:text-red-500"
                />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrepColumn({
  title,
  kind,
  items,
  bookingId,
  t,
}: {
  title: string;
  kind: "MATERIAL" | "OPERATION";
  items: { id: string; label: string; qty: string | null; remark: string | null; done: boolean }[];
  bookingId: string;
  t: (s: string) => string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-800">
        {title} <span className="text-xs font-normal text-slate-400">({items.length})</span>
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <form action={togglePrepItemAction.bind(null, it.id)}>
              <button
                className={`flex h-4 w-4 items-center justify-center rounded border ${it.done ? "border-accent bg-accent text-white" : "border-slate-300 text-transparent"}`}
                aria-label={t("Toggle task")}
              >
                ✓
              </button>
            </form>
            <span className={`flex-1 ${it.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
              {it.label}
              {it.qty ? <span className="ml-1 text-xs text-slate-500">{it.qty}</span> : null}
              {it.remark ? <span className="ml-1 text-xs text-amber-600">· {it.remark}</span> : null}
            </span>
            <form action={deletePrepItemAction.bind(null, it.id)}>
              <ConfirmSubmit
                label="✕"
                ariaLabel={t("Delete")}
                title={t("Delete this item?")}
                confirmLabel={t("Delete")}
                buttonClassName="text-slate-400 hover:text-red-500"
              />
            </form>
          </li>
        ))}
      </ul>
      <form action={addPrepItemAction.bind(null, bookingId)} className="mt-2 flex flex-wrap gap-1.5">
        <input type="hidden" name="kind" value={kind} />
        <input
          name="label"
          placeholder={t("Add item")}
          className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <input
          name="qty"
          placeholder={t("Qty")}
          className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <button className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">+</button>
      </form>
    </div>
  );
}
