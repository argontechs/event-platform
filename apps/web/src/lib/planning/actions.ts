"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { getActiveCompanyId } from "../tenant";
import type { SessionUser } from "../auth/session";
import { EVENT_TYPES } from "../leads/schema";

export type PlanningFormState = { error: string; fieldErrors?: Record<string, string> };

const BOOKING_STATUSES = [
  "CONFIRMED", "IN_PLANNING", "READY", "EXECUTED", "COMPLETED", "CLOSED", "CANCELLED",
] as const;

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
function canAccess(user: SessionUser, companyId: string): boolean {
  return isSuperAdmin(user) || user.companyId === companyId;
}
/** Parse a money field; fall back to `def` for blank/garbage/negative input. */
function money(raw: string, def: number): number {
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) && n >= 0 ? n : def;
}
function validEventType(raw: string, fallback: string): string {
  return (EVENT_TYPES as readonly string[]).includes(raw) ? raw : fallback;
}

async function seedTasks(bookingId: string, companyId: string, eventType: string): Promise<void> {
  const existing = await prisma.planningTask.count({ where: { bookingId } });
  if (existing > 0) return;
  const tpl =
    (await prisma.checklistTemplate.findFirst({ where: { companyId, eventType: eventType as never } })) ??
    (await prisma.checklistTemplate.findFirst({ where: { companyId: null, eventType: eventType as never } })) ??
    (await prisma.checklistTemplate.findFirst({ where: { companyId: null, eventType: "OTHER" as never } }));
  const items = Array.isArray(tpl?.items) ? (tpl?.items as { title: string; category?: string }[]) : [];
  if (items.length === 0) return;
  await prisma.planningTask.createMany({
    data: items.map((it, i) => ({ companyId, bookingId, title: it.title, category: it.category ?? null, sortOrder: i })),
  });
}

// ───────────────────────── Locations ─────────────────────────

function locationData(fd: FormData) {
  const lat = s(fd, "lat");
  const lng = s(fd, "lng");
  return {
    name: s(fd, "name"),
    addressLine1: s(fd, "addressLine1") || null,
    city: s(fd, "city") || null,
    state: s(fd, "state") || null,
    postcode: s(fd, "postcode") || null,
    lat: lat && Number.isFinite(Number(lat)) ? Number(lat) : null,
    lng: lng && Number.isFinite(Number(lng)) ? Number(lng) : null,
    capacity: s(fd, "capacity") ? parseInt(s(fd, "capacity"), 10) : null,
    contactName: s(fd, "contactName") || null,
    contactPhone: s(fd, "contactPhone") || null,
    notes: s(fd, "notes") || null,
  };
}

export async function createLocationAction(
  _prev: PlanningFormState,
  fd: FormData,
): Promise<PlanningFormState> {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };
  const data = locationData(fd);
  if (!data.name) return { error: "Location name is required." };
  await prisma.location.create({ data: { companyId, ...data } });
  revalidatePath("/planning/locations");
  redirect("/planning/locations");
}

export async function updateLocationAction(
  locationId: string,
  _prev: PlanningFormState,
  fd: FormData,
): Promise<PlanningFormState> {
  const user = await requireUser();
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc || !canAccess(user, loc.companyId)) return { error: "Not found." };
  const data = locationData(fd);
  if (!data.name) return { error: "Location name is required." };
  await prisma.location.update({ where: { id: locationId }, data });
  revalidatePath("/planning/locations");
  redirect("/planning/locations");
}

// If the user typed a new venue (no saved location picked), save it as a
// reusable Location so it shows in the venues list + on the map next time.
async function resolveLocationId(companyId: string, fd: FormData): Promise<string | null> {
  const picked = s(fd, "locationId");
  if (picked) {
    // Never trust a client-supplied location id — confirm it belongs to this tenant.
    const loc = await prisma.location.findFirst({ where: { id: picked, companyId }, select: { id: true } });
    return loc ? loc.id : null;
  }
  const venue = s(fd, "venueText");
  if (!venue) return null;
  const lat = s(fd, "lat");
  const lng = s(fd, "lng");
  const loc = await prisma.location.create({
    data: {
      companyId,
      name: venue,
      lat: lat && Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: lng && Number.isFinite(Number(lng)) ? Number(lng) : null,
    },
  });
  return loc.id;
}

// ───────────────────────── Events (bookings) ─────────────────────────

export async function createEventAction(
  _prev: PlanningFormState,
  fd: FormData,
): Promise<PlanningFormState> {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };

  const title = s(fd, "title");
  if (!title) return { error: "Event title is required." };
  const eventType = validEventType(s(fd, "eventType"), "OTHER");
  const eventDate = s(fd, "eventDate");
  const total = money(s(fd, "totalAmount"), 0);
  const locationId = await resolveLocationId(companyId, fd);

  const booking = await prisma.booking.create({
    data: {
      companyId,
      title,
      eventType: eventType as never,
      eventDate: eventDate ? new Date(eventDate) : null,
      locationId,
      venueText: s(fd, "venueText") || null,
      status: "IN_PLANNING",
      totalAmount: total,
      balanceDue: total,
      depositPaid: 0,
    },
  });
  await seedTasks(booking.id, companyId, eventType);
  redirect(`/planning/${booking.id}`);
}

export async function updateEventAction(
  bookingId: string,
  _prev: PlanningFormState,
  fd: FormData,
): Promise<PlanningFormState> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return { error: "Not found." };

  // Event value is editable on the board; keep balanceDue consistent.
  const total = money(s(fd, "totalAmount"), Number(booking.totalAmount));
  const balanceDue = Math.max(0, total - Number(booking.depositPaid));

  // Whitelist enum fields rather than casting arbitrary form strings into Prisma.
  const statusRaw = s(fd, "status");
  const status = (BOOKING_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : booking.status;
  const eventType = validEventType(s(fd, "eventType"), booking.eventType);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      title: s(fd, "title") || booking.title,
      eventType: eventType as never,
      eventDate: s(fd, "eventDate") ? new Date(s(fd, "eventDate")) : null,
      locationId: await resolveLocationId(booking.companyId, fd),
      venueText: s(fd, "venueText") || null,
      status: status as never,
      totalAmount: total,
      balanceDue,
    },
  });
  revalidatePath(`/planning/${bookingId}`);
  return { error: "" };
}

export async function deleteRunSheetAction(entryId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const entry = await prisma.runSheetEntry.findUnique({ where: { id: entryId } });
  if (!entry || !canAccess(user, entry.companyId)) return;
  await prisma.runSheetEntry.delete({ where: { id: entryId } });
  revalidatePath(`/planning/${entry.bookingId}`);
}

export async function removeSupplierFromEventAction(
  bookingSupplierId: string,
  _fd: FormData,
): Promise<void> {
  const user = await requireUser();
  const bs = await prisma.bookingSupplier.findUnique({
    where: { id: bookingSupplierId },
    include: { booking: { select: { companyId: true } } },
  });
  if (!bs || !canAccess(user, bs.booking.companyId)) return;
  await prisma.bookingSupplier.delete({ where: { id: bookingSupplierId } });
  revalidatePath(`/planning/${bs.bookingId}`);
}

// ───────────────────────── Tasks ─────────────────────────

export async function addTaskAction(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;
  const title = s(fd, "title");
  if (!title) return;
  const count = await prisma.planningTask.count({ where: { bookingId } });
  await prisma.planningTask.create({
    data: { companyId: booking.companyId, bookingId, title, category: s(fd, "category") || null, sortOrder: count },
  });
  revalidatePath(`/planning/${bookingId}`);
}

export async function toggleTaskAction(taskId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const task = await prisma.planningTask.findUnique({ where: { id: taskId } });
  if (!task || !canAccess(user, task.companyId)) return;
  await prisma.planningTask.update({
    where: { id: taskId },
    data: { status: task.status === "DONE" ? "TODO" : "DONE" },
  });
  revalidatePath(`/planning/${task.bookingId}`);
}

export async function deleteTaskAction(taskId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const task = await prisma.planningTask.findUnique({ where: { id: taskId } });
  if (!task || !canAccess(user, task.companyId)) return;
  await prisma.planningTask.delete({ where: { id: taskId } });
  revalidatePath(`/planning/${task.bookingId}`);
}

// ───────────────────────── Run sheet ─────────────────────────

export async function addRunSheetAction(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;
  const activity = s(fd, "activity");
  if (!activity) return;
  const count = await prisma.runSheetEntry.count({ where: { bookingId } });
  await prisma.runSheetEntry.create({
    data: {
      companyId: booking.companyId,
      bookingId,
      time: s(fd, "time") || null,
      activity,
      owner: s(fd, "owner") || null,
      sortOrder: count,
    },
  });
  revalidatePath(`/planning/${bookingId}`);
}

// ───────────────────────── Suppliers (quick add + assign) ─────────────────────────

export async function addSupplierToEventAction(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;
  const name = s(fd, "name");
  if (!name) return;
  const cost = s(fd, "cost") ? Number(s(fd, "cost")) : null;
  const supplier = await prisma.supplier.create({
    data: { companyId: booking.companyId, name, type: s(fd, "type") || null, phone: s(fd, "phone") || null },
  });
  await prisma.bookingSupplier.create({
    data: { bookingId, supplierId: supplier.id, role: s(fd, "type") || null, cost },
  });
  revalidatePath(`/planning/${bookingId}`);
}

// ── Setup / dismantle crew (assign staff or a named person to a phase) ──
export async function addCrewToEventAction(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;

  const userId = s(fd, "userId") || null;
  const name = s(fd, "name") || null;
  if (!userId && !name) return; // need a staff member or a typed name

  // A supplied staff id must belong to this company (don't leak other tenants' staff).
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
    if (!u || u.companyId !== booking.companyId) return;
  }

  const phaseRaw = s(fd, "phase");
  const phase = phaseRaw === "DISMANTLE" || phaseRaw === "BOTH" ? phaseRaw : "SETUP";

  await prisma.bookingCrew.create({
    data: {
      companyId: booking.companyId,
      bookingId,
      userId,
      name: userId ? null : name, // system user → name comes from the relation
      phase: phase as never,
      role: s(fd, "role") || null,
      phone: s(fd, "phone") || null,
    },
  });
  revalidatePath(`/planning/${bookingId}`);
}

export async function removeCrewFromEventAction(crewId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const cm = await prisma.bookingCrew.findUnique({ where: { id: crewId } });
  if (!cm || !canAccess(user, cm.companyId)) return;
  await prisma.bookingCrew.delete({ where: { id: crewId } });
  revalidatePath(`/planning/${cm.bookingId}`);
}

// ── Preparation / loading list (materials to bring + operations on site) ──
const PREP_TEMPLATE: { kind: "MATERIAL" | "OPERATION"; label: string; qty?: string }[] = [
  { kind: "MATERIAL", label: "Water base", qty: "x6" },
  { kind: "MATERIAL", label: "Pasir (sand)", qty: "x6" },
  { kind: "MATERIAL", label: "Papan (board)", qty: "2 set" },
  { kind: "MATERIAL", label: "Kok Zhai" },
  { kind: "MATERIAL", label: "Cover", qty: "x8" },
  { kind: "MATERIAL", label: "Drill" },
  { kind: "MATERIAL", label: "Screw" },
  { kind: "MATERIAL", label: "Ladder", qty: "x2" },
  { kind: "MATERIAL", label: "Heat gun", qty: "x2" },
  { kind: "MATERIAL", label: "Red carpet", qty: "x2 roll" },
  { kind: "OPERATION", label: "Tool bag (scissors, knife, cloth tape, fish ring, cable tie, double-side tape, clip)" },
  { kind: "OPERATION", label: "Extension cables", qty: "x10" },
  { kind: "OPERATION", label: "Black cloth cover backdrop" },
  { kind: "OPERATION", label: "Su Wen light", qty: "x12" },
  { kind: "OPERATION", label: "COB light (yellow)", qty: "x10" },
  { kind: "OPERATION", label: "Transformer" },
  { kind: "OPERATION", label: "Track light", qty: "x4" },
  { kind: "OPERATION", label: "All banners" },
  { kind: "OPERATION", label: "All foam boards" },
  { kind: "OPERATION", label: "3D wording foam board" },
];

export async function addPrepItemAction(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;
  const label = s(fd, "label");
  if (!label) return;
  const kind = s(fd, "kind") === "OPERATION" ? "OPERATION" : "MATERIAL";
  await prisma.prepItem.create({
    data: {
      companyId: booking.companyId,
      bookingId,
      kind: kind as never,
      label,
      qty: s(fd, "qty") || null,
      remark: s(fd, "remark") || null,
    },
  });
  revalidatePath(`/planning/${bookingId}`);
}

export async function togglePrepItemAction(prepId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const item = await prisma.prepItem.findUnique({ where: { id: prepId } });
  if (!item || !canAccess(user, item.companyId)) return;
  await prisma.prepItem.update({ where: { id: prepId }, data: { done: !item.done } });
  revalidatePath(`/planning/${item.bookingId}`);
}

export async function deletePrepItemAction(prepId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const item = await prisma.prepItem.findUnique({ where: { id: prepId } });
  if (!item || !canAccess(user, item.companyId)) return;
  await prisma.prepItem.delete({ where: { id: prepId } });
  revalidatePath(`/planning/${item.bookingId}`);
}

export async function loadPrepTemplateAction(bookingId: string, _fd: FormData): Promise<void> {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !canAccess(user, booking.companyId)) return;
  const existing = await prisma.prepItem.count({ where: { bookingId } });
  if (existing > 0) return; // don't duplicate an existing list
  await prisma.prepItem.createMany({
    data: PREP_TEMPLATE.map((it, i) => ({
      companyId: booking.companyId,
      bookingId,
      kind: it.kind as never,
      label: it.label,
      qty: it.qty ?? null,
      sortOrder: i,
    })),
  });
  revalidatePath(`/planning/${bookingId}`);
}
