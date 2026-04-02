"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StatusFilter = "all" | "active" | "inactive";

const ORDER: StatusFilter[] = ["all", "active", "inactive"];

const LABELS: Record<StatusFilter, string> = {
  all: "すべて",
  active: "有効のみ",
  inactive: "無効のみ"
};

const ICONS: Record<StatusFilter, string> = {
  all: "filter_alt",
  active: "run_circle",
  inactive: "block"
};

function normalizeStatus(value: string): StatusFilter {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

export function StatusFilterToggle({ statusFilter }: { statusFilter: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = normalizeStatus(statusFilter);
  const currentIndex = ORDER.indexOf(current);
  const next = ORDER[(currentIndex + 1) % ORDER.length];

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <button type="button" className="admin-filter-mode-button" onClick={handleToggle} aria-label={`表示を${LABELS[next]}に切り替える`}>
      <span className="material-symbols-outlined admin-filter-mode-icon" aria-hidden="true">
        {ICONS[current]}
      </span>
      <span className="admin-filter-mode-label">{LABELS[current]}</span>
    </button>
  );
}
