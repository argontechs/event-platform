import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { updateLocationAction } from "@/lib/planning/actions";
import { LocationForm, type LocationValues } from "@/components/planning/location-form";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const loc = await prisma.location.findUnique({ where: { id } });
  if (!loc) notFound();
  if (!isSuperAdmin(user) && user.companyId !== loc.companyId) redirect("/planning/locations");

  const values: LocationValues = {
    name: loc.name,
    addressLine1: loc.addressLine1 ?? "",
    city: loc.city ?? "",
    state: loc.state ?? "",
    postcode: loc.postcode ?? "",
    lat: loc.lat != null ? String(loc.lat) : "",
    lng: loc.lng != null ? String(loc.lng) : "",
    capacity: loc.capacity != null ? String(loc.capacity) : "",
    contactName: loc.contactName ?? "",
    contactPhone: loc.contactPhone ?? "",
    notes: loc.notes ?? "",
  };

  return (
    <section>
      <Link href="/planning/locations" className="text-sm text-slate-500 hover:text-slate-900">
        ← Locations
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{loc.name}</h1>
      <div className="mt-6">
        <LocationForm
          action={updateLocationAction.bind(null, loc.id)}
          initial={values}
          submitLabel="Save location"
        />
      </div>
    </section>
  );
}
