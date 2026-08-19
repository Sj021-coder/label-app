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

export default function NavTabs({ isAdmin = false }) {
  const pathname = usePathname();
  // Fans never see the Admin tab — only admins do.
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
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
