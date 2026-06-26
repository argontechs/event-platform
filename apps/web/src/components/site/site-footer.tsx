import type { Dictionary } from "@/lib/i18n/dictionaries";

export type SocialLinks = {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
};

export function SiteFooter({
  dict,
  brandName,
  social,
}: {
  dict: Dictionary["footer"];
  brandName: string;
  social?: SocialLinks;
}) {
  const year = new Date().getFullYear();
  const links = [
    { href: social?.facebookUrl, label: "Facebook" },
    { href: social?.instagramUrl, label: "Instagram" },
    { href: social?.tiktokUrl, label: "TikTok" },
    { href: social?.youtubeUrl, label: "YouTube" },
  ].filter((l) => l.href);

  return (
    <footer className="border-t border-white/10 px-6 py-10 text-sm text-white/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-white/70">{brandName}</span>
        <span>{dict.tagline}</span>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href as string}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
        <span>
          © {year} · {dict.rights}
        </span>
      </div>
    </footer>
  );
}
