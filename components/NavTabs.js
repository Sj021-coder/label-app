"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/roster", label: "Roster" },
  { href: "/draft", label: "Draft" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/admin", label: "Admin" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="flex px-4 gap-1 border-b border-[var(--border)] mb-4">
      {TABS.map((t) => {
        const active = pathname === t.href;
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
