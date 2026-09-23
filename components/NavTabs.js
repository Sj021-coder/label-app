"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/roster", label: "Signature" },
  { href: "/draft", label: "Artistes" },
  { href: "/radar", label: "Radar" },
  { href: "/pickem", label: "Pick'em" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/league", label: "Ligues" },
  { href: "/team", label: "Équipes" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

// eslint-disable-next-line no-unused-vars
export default function NavTabs({ isAdmin = false }) {
  const pathname = usePathname();
  // TEMPORARY, pre-launch only: the Admin tab is always visible now — the
  // real gate is the shared code on the page itself (see AdminCodeGate),
  // not whether the tab is shown. Simpler to find on mobile than requiring
  // a manual URL edit. Revert to filtering by isAdmin once real users exist.
  const tabs = TABS;
  return (
    <div className="flex px-4 gap-1 border-b border-[var(--border)] mb-4">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center py-2.5 pb-3 text-[11px] font-bold uppercase tracking-wide border-b-2 ${
              active
                ? "text-[var(--gold)] border-[var(--gold)]"
                : "text-[var(--text-faint)] border-transparent"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
