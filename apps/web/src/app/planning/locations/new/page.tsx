import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { createLocationAction } from "@/lib/planning/actions";
import { LocationForm } from "@/components/planning/location-form";

export const dynamic = "force-dynamic";

export default async function NewLocationPage() {
  await requireUser();
  return (
    <section>
      <Link href="/planning/locations" className="text-sm text-slate-500 hover:text-slate-900">
        ← Locations
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New location</h1>
      <div className="mt-6">
        <LocationForm action={createLocationAction} submitLabel="Create location" />
      </div>
    </section>
  );
}
