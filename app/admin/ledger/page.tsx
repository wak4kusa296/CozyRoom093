import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { DeleteGuestButton } from "@/app/admin/ledger/delete-guest-button";
import { ActiveStatusSelect } from "@/app/admin/ledger/active-status-select";
import { AdminLedgerInlineEditForm } from "@/app/admin/ledger/inline-edit-form";
import { StatusFilterToggle } from "@/app/admin/ledger/status-filter-toggle";
import {
  listGuestCredentialsWithStatus,
  setGuestActive,
  syncGuestCredentialsFromEnv,
  updateGuestName,
  updateGuestPhrase,
  upsertGuestCredential
} from "@/lib/guest-credentials";
import { revalidatePath } from "next/cache";

function buildGuestIdFromNow() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

async function addGuestAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await upsertGuestCredential({
      guestId: buildGuestIdFromNow(),
      guestName: String(formData.get("guestName") ?? ""),
      phrase: String(formData.get("phrase") ?? "")
    });
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function updatePhraseAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await updateGuestPhrase(String(formData.get("guestId") ?? ""), String(formData.get("phrase") ?? ""));
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function updateNameAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await updateGuestName(String(formData.get("guestId") ?? ""), String(formData.get("guestName") ?? ""));
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function setGuestActiveAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const activeValue = String(formData.get("isActive") ?? "");
  try {
    await setGuestActive(String(formData.get("guestId") ?? ""), activeValue === "true");
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

export default async function AdminLedgerPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireAdminSession();
  try {
    await syncGuestCredentialsFromEnv();
  } catch {
    // Keep page available even if DB synchronization fails.
  }

  const resolvedSearchParams = await searchParams;
  const statusFilter = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0] ?? "all"
    : resolvedSearchParams.status ?? "all";

  const credentials = await listGuestCredentialsWithStatus().catch(() => []);
  const filteredCredentials = credentials.filter((item) => {
    if (statusFilter === "active") return item.isActive;
    if (statusFilter === "inactive") return !item.isActive;
    return true;
  });

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>ユーザー管理</h1>
          <p className="lead">ユーザーと秘密の言葉の対応表を編集できます。</p>
        </div>
        <AdminNav />
        <section className="stack admin-panel">
          <h2>ユーザー追加</h2>
          <form action={addGuestAction} className="admin-inline-form">
            <label>
              表示名
              <input name="guestName" type="text" lang="ja" autoComplete="name" required />
            </label>
            <label>
              合言葉
              <input name="phrase" required />
            </label>
            <button type="submit" className="admin-add-button">
              追加する
            </button>
          </form>
          <p className="meta">ユーザーIDは登録日時（年月日・時分秒）で自動割り当てされます。</p>
        </section>

        <section className="admin-filter-row" aria-label="状態フィルター">
          <StatusFilterToggle statusFilter={statusFilter} />
        </section>

        {filteredCredentials.length === 0 ? (
          <p className="meta">対応表データがありません。</p>
        ) : (
          <div className="admin-table-wrap admin-table-wrap-plain">
            <table className="admin-table admin-table-mobile-card admin-table-mobile-cards admin-ledger-user-table">
              <colgroup>
                <col className="admin-ledger-col-id" />
                <col className="admin-ledger-col-display" />
                <col className="admin-ledger-col-phrase" />
                <col className="admin-ledger-col-status" />
                <col className="admin-ledger-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>ユーザーID</th>
                  <th>表示名</th>
                  <th>秘密の言葉</th>
                  <th>状態</th>
                  <th scope="col" className="admin-table-col-actions">
                    削除
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCredentials.map((item) => (
                  <tr key={item.guestId} className={item.isActive ? undefined : "admin-row-inactive"}>
                    <td data-label="ユーザーID">{item.guestId}</td>
                    <td data-label="表示名">
                      <div className="admin-phrase-line">
                        <span>{item.guestName}</span>
                        <details className="admin-edit-disclosure">
                          <summary className="admin-edit-summary" aria-label="表示名編集を開く">
                            <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
                              edit
                            </span>
                          </summary>
                          <AdminLedgerInlineEditForm action={updateNameAction} className="admin-inline-form admin-inline-form-compact">
                            <input type="hidden" name="guestId" value={item.guestId} />
                            <input
                              name="guestName"
                              type="text"
                              lang="ja"
                              autoComplete="name"
                              defaultValue={item.guestName}
                              required
                            />
                            <button type="submit" className="sr-only" tabIndex={-1}>
                              保存
                            </button>
                          </AdminLedgerInlineEditForm>
                        </details>
                      </div>
                    </td>
                    <td data-label="秘密の言葉">
                      <div className="admin-phrase-line">
                        <code className="admin-phrase-text">{item.phrase}</code>
                        <details className="admin-edit-disclosure">
                          <summary className="admin-edit-summary" aria-label="秘密の言葉の編集を開く">
                            <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
                              edit
                            </span>
                          </summary>
                          <AdminLedgerInlineEditForm action={updatePhraseAction} className="admin-inline-form admin-inline-form-compact">
                            <input type="hidden" name="guestId" value={item.guestId} />
                            <textarea name="phrase" defaultValue={item.phrase} required rows={1} className="admin-phrase-editor" />
                            <button type="submit" className="sr-only" tabIndex={-1}>
                              保存
                            </button>
                          </AdminLedgerInlineEditForm>
                        </details>
                      </div>
                    </td>
                    <td data-label="状態">
                      <ActiveStatusSelect guestId={item.guestId} isActive={item.isActive} action={setGuestActiveAction} />
                    </td>
                    <td data-label="削除" className="admin-table-cell-actions">
                      {item.guestId !== "admin" ? <DeleteGuestButton guestId={item.guestId} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
