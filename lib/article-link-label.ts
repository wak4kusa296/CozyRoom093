/**
 * スタンドアロン表示時に OG カードではなくラベルボタンにするか。
 * リンクテキストが URL そのもの（または正規化で一致）でないとき true。
 */
export function isCustomLinkLabelForPreview(href: string, label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  if (t === href) return false;

  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      if (t === u.href) return false;
      const strip = (s: string) => s.replace(/\/$/, "");
      if (strip(t) === strip(u.href)) return false;
    } catch {
      return true;
    }
  }

  return true;
}
