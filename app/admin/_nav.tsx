import Link from "next/link";

const links = [
  { href: "/admin/ledger", label: "ユーザー管理", icon: "group" },
  { href: "/admin/content", label: "記事管理", icon: "edit_note" },
  { href: "/admin/magazines", label: "マガジン管理", icon: "collections_bookmark" },
  { href: "/admin/letters", label: "文通管理", icon: "mail" },
  { href: "/admin/push", label: "プッシュ通知", icon: "notifications" }
] as const;

export function AdminNav() {
  return (
    <nav className="admin-subnav" aria-label="管理画面ナビゲーション">
      <Link href="/admin" className="admin-subnav-link">
        <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
          dashboard
        </span>
        <span>管理トップ</span>
      </Link>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="admin-subnav-link">
          <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
            {link.icon}
          </span>
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
