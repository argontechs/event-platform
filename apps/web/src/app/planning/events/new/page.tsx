import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { createEventAction } from "@/lib/planning/actions";
import { EventForm } from "@/components/planning/event-form";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);

  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">New event</h1>
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      </section>
    );
  }

  const locations = await prisma.location.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <section>
      <Link href="/planning" className="text-sm text-slate-500 hover:text-slate-900">
        ← Planning
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New event</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manually add an event and assign a location. The checklist is seeded by event type.
      </p>
      <div className="mt-6">
        <EventForm action={createEventAction} locations={locations} submitLabel="Create event" />
      </div>
    </section>
  );
}
