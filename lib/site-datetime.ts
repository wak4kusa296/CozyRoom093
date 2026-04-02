/** サイト共通の日時表示（アジア・東京） */

const TOKYO = "Asia/Tokyo";

function tokyoParts(d: Date, withSeconds: boolean) {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  };
  if (withSeconds) opts.second = "2-digit";
  const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(d);
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

/** `YYYY.MM.DD HH.MM`（例: 2026.04.01 22.59） */
export function formatSiteDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = tokyoParts(d, false);
  const y = p.year ?? "";
  const mo = p.month ?? "";
  const day = p.day ?? "";
  const h = p.hour ?? "";
  const mi = p.minute ?? "";
  return `${y}.${mo}.${day} ${h}.${mi}`;
}

/** `YYYY.MM.DD HH.MM.SS` */
export function formatSiteDateTimeWithSeconds(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = tokyoParts(d, true);
  const y = p.year ?? "";
  const mo = p.month ?? "";
  const day = p.day ?? "";
  const h = p.hour ?? "";
  const mi = p.minute ?? "";
  const s = p.second ?? "";
  return `${y}.${mo}.${day} ${h}.${mi}.${s}`;
}
