/**
 * 通知の「いつより前／以前」を切るための UTC 瞬間比較。
 *
 * - `broadcast_pushes.sent_at` は TIMESTAMPTZ → アプリでは `toISOString()`（UTC Z 付き）。
 * - 台帳の `created_at` / `updated_at` も同様。
 * - **表示が 12h / 24h かは比較に無関係**（数値はミリ秒の Unix 時刻）。
 * - 記事の `date` が日付のみのときは frontmatter 解決時点の ISO（多くは UTC 0:00）と揃える。
 */

function utcInstantMs(iso: string): number | null {
  const t = Date.parse(iso.trim());
  return Number.isNaN(t) ? null : t;
}

/** aIso の瞬間が bIso より前なら true（同一瞬間は false） */
export function isEventStrictlyBeforeCutoff(
  eventIso: string,
  cutoffIso: string | null | undefined
): boolean {
  if (!cutoffIso?.trim()) return false;
  if (!eventIso.trim()) return false;
  const ev = utcInstantMs(eventIso);
  const ac = utcInstantMs(cutoffIso);
  if (ev === null || ac === null) return false;
  return ev < ac;
}

/** aIso の瞬間が cutoff 以前（同一瞬間を含む）なら true。ベースライン「初回以前は未読に出さない」用。 */
export function isEventAtOrBeforeCutoff(
  eventIso: string,
  cutoffIso: string | null | undefined
): boolean {
  if (!cutoffIso?.trim()) return false;
  if (!eventIso.trim()) return false;
  const ev = utcInstantMs(eventIso);
  const ac = utcInstantMs(cutoffIso);
  if (ev === null || ac === null) return false;
  return ev <= ac;
}
