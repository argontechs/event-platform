import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { isLocale } from "@/lib/i18n/config";
import { getCompanyByHost } from "@/lib/tenant";
import { parseInclusions, groupByCode } from "@/lib/packages/format";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PackagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const host = (await headers()).get("host");
  const company =
    (await getCompanyByHost(host).catch(() => null)) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));
  const packages = company
    ? await prisma.package.findMany({
        where: { companyId: company.id, active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6">
      <h1 className="text-4xl font-semibold sm:text-5xl">Our Packages</h1>
      <p className="mt-3 max-w-xl text-white/60">Pick a package or mix and match — we&apos;ll tailor it to your event.</p>

      {packages.length === 0 ? (
        <p className="mt-12 text-white/50">Packages coming soon.</p>
      ) : (
        groupByCategory(packages).map((group) => (
          <section key={group.category} className="mt-14">
            <h2 className="text-2xl font-semibold text-white/90">{group.category}</h2>
            <div className="mt-6 space-y-8">
              {(() => {
                // Coded designs render full-width with their tiers side by side;
                // consecutive uncoded packages keep the original 3-up card grid.
                const blocks = groupByCode(group.items as PkgRow[]);
                const out: React.ReactNode[] = [];
                let batch: PkgRow[] = [];
                const flush = () => {
                  if (batch.length === 0) return;
                  out.push(
                    <div key={`singles-${out.length}`} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {batch.map((p, i) => <SingleCard key={p.id} p={p} reveal={(i % 4) + 1} />)}
                    </div>,
                  );
                  batch = [];
                };
                for (const b of blocks) {
                  if (b.kind === "single") {
                    batch.push(b.pkg);
                    continue;
                  }
                  flush();
                  out.push(
                    <div key={b.code} className="card-glow rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-lg font-medium">{b.tiers[0]?.name ?? group.category}</h3>
                        <span className="text-xs uppercase tracking-wide text-white/40">{b.code}</span>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {b.tiers.map((tp) => <TierCard key={tp.id} p={tp} />)}
                      </div>
                    </div>,
                  );
                }
                flush();
                return out;
              })()}
            </div>
          </section>
        ))
      )}

      <div className="mt-14">
        <Link href={`/${locale}/contact`} className="rounded-full px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:brightness-110" style={{ backgroundColor: "var(--brand, #2f6fed)" }}>
          Enquire now
        </Link>
      </div>
    </main>
  );
}

type PkgRow = {
  id: string;
  name: string;
  code: string | null;
  tierLabel: string | null;
  category: string | null;
  price: unknown;
  originalPrice: unknown;
  description: string | null;
  imageUrls: unknown;
};

// Group packages by category, preserving first-seen order (Wedding, then Birthday, …).
function groupByCategory(packages: PkgRow[]): { category: string; items: PkgRow[] }[] {
  const groups: { category: string; items: PkgRow[] }[] = [];
  for (const p of packages) {
    const cat = p.category || "Other";
    let g = groups.find((x) => x.category === cat);
    if (!g) {
      g = { category: cat, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  return groups;
}

function Inclusions({ description }: { description: string | null }) {
  const items = parseInclusions(description);
  if (items.length === 0) return null;
  if (items.length === 1 && !(description ?? "").includes("•")) {
    return <p className="mt-2 text-sm leading-relaxed text-white/55">{items[0]}</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-white/55">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Price({ price, originalPrice }: { price: unknown; originalPrice: unknown }) {
  const p = Number(price);
  const op = originalPrice == null ? 0 : Number(originalPrice);
  if (p <= 0) return <p className="whitespace-nowrap text-xs uppercase tracking-wide text-sky-300/70">Included</p>;
  return (
    <p className="whitespace-nowrap font-semibold text-sky-300">
      {op > p ? <span className="mr-1 text-xs font-normal text-white/40 line-through">RM {money(op)}</span> : null}
      RM {money(p)}
    </p>
  );
}

function SingleCard({ p, reveal }: { p: PkgRow; reveal: number }) {
  const imgs = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]) : [];
  return (
    <div className={`card-glow reveal reveal-${reveal} overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]`}>
      {imgs[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgs[0]} alt={p.name} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-white/[0.08] to-transparent" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-medium">{p.name}</h3>
          <Price price={p.price} originalPrice={p.originalPrice} />
        </div>
        <Inclusions description={p.description} />
      </div>
    </div>
  );
}

function TierCard({ p }: { p: PkgRow }) {
  const imgs = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]) : [];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {imgs[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgs[0]} alt={p.tierLabel ?? p.name} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-white/[0.08] to-transparent" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-base font-medium">{p.tierLabel ?? p.name}</h4>
          <Price price={p.price} originalPrice={p.originalPrice} />
        </div>
        <Inclusions description={p.description} />
      </div>
    </div>
  );
}
