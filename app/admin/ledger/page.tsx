import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { DeleteGuestButton } from "@/app/admin/ledger/delete-guest-button";
import { ActiveStatusSelect } from "@/app/admin/ledger/active-status-select";
import { AdminLedgerInlineEditForm } from "@/app/admin/ledger/inline-edit-form";
import { StatusFilterToggle } from "@/app/admin/ledger/status-filter-toggle";
import { GateActiveStatusSelect } from "@/app/admin/ledger/gate-active-status-select";
import { DeleteGateButton } from "@/app/admin/ledger/delete-gate-button";
import {
  buildGuestIdFromNow,
  insertGuestCredential,
  listGuestCredentialsWithStatus,
  setGuestActive,
  syncGuestCredentialsFromEnv,
  updateGuestAdminMemo,
  updateGuestName,
  updateGuestPhrase
} from "@/lib/guest-credentials";
import {
  buildGateIdFromNow,
  deleteRegistrationGate,
  listRegistrationGates,
  setRegistrationGateActive,
  updateRegistrationGateLabel,
  updateRegistrationGatePhrase,
  upsertRegistrationGate
} from "@/lib/registration-gates";
import {
  HANDWRITTEN_PASSWORD_PAPER_HINT,
  HANDWRITTEN_PASSWORD_RULE_HINT,
  isValidSecretPhrase,
  secretPhraseContainsWhitespace
} from "@/lib/passphrase-rules";
import { revalidatePath } from "next/cache";

async function addGuestAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    const phrase = String(formData.get("phrase") ?? "");
    if (secretPhraseContainsWhitespace(phrase) || !isValidSecretPhrase(phrase)) return;
    await insertGuestCredential({
      guestId: buildGuestIdFromNow(),
      guestName: String(formData.get("guestName") ?? ""),
      phrase,
      adminMemo: String(formData.get("adminMemo") ?? "")
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
    const phrase = String(formData.get("phrase") ?? "");
    if (secretPhraseContainsWhitespace(phrase) || !isValidSecretPhrase(phrase)) return;
    await updateGuestPhrase(String(formData.get("guestId") ?? ""), phrase);
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

async function updateAdminMemoAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await updateGuestAdminMemo(String(formData.get("guestId") ?? ""), String(formData.get("adminMemo") ?? ""));
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

async function addGateAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await upsertRegistrationGate({
      gateId: buildGateIdFromNow(),
      phrase: String(formData.get("phrase") ?? ""),
      label: String(formData.get("label") ?? "")
    });
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function setGateActiveAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const activeValue = String(formData.get("isActive") ?? "");
  try {
    await setRegistrationGateActive(String(formData.get("gateId") ?? ""), activeValue === "true");
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function updateGatePhraseAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await updateRegistrationGatePhrase(String(formData.get("gateId") ?? ""), String(formData.get("phrase") ?? ""));
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function updateGateLabelAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await updateRegistrationGateLabel(String(formData.get("gateId") ?? ""), String(formData.get("label") ?? ""));
  } catch {
    // Keep screen usable even if constraints fail.
  }
  revalidatePath("/admin/ledger");
}

async function deleteGateAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  try {
    await deleteRegistrationGate(String(formData.get("gateId") ?? ""));
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

  const credentials = await listGuestCredentialsWithStatus().catch(
    (): Awaited<ReturnType<typeof listGuestCredentialsWithStatus>> => []
  );
  const gates = await listRegistrationGates().catch((): Awaited<ReturnType<typeof listRegistrationGates>> => []);
  const filteredCredentials = credentials.filter((item) => {
    if (statusFilter === "active") return item.isActive;
    if (statusFilter === "inactive") return !item.isActive;
    return true;
  });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const joinUrl = siteUrl ? `${siteUrl}/join` : "/join";

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>ユーザー管理</h1>
          <p className="lead">ユーザーと秘密の言葉の対応表を編集できます。</p>
        </div>
        <AdminNav />

        <section className="stack admin-panel">
          <h2>手書きのパスワード</h2>
          <ul className="meta admin-gate-hints">
            <li>
              QR の行き先は <code>{joinUrl}</code> です。紙に書いた手書きのパスワードが有効なときだけ、そこから自己登録できます。無効にすると登録できなくなります。
            </li>
            <li>{HANDWRITTEN_PASSWORD_RULE_HINT}</li>
            <li>{HANDWRITTEN_PASSWORD_PAPER_HINT}</li>
          </ul>
          <form action={addGateAction} className="admin-inline-form">
            <label>
              メモ（任意）
              <input name="label" type="text" lang="ja" autoComplete="off" placeholder="例: 4月の会" />
            </label>
            <label>
              手書きのパスワード
              <input name="phrase" required autoComplete="off" lang="en" spellCheck={false} pattern="[!-~]+" title="半角の英数字・記号のみ" />
            </label>
            <button type="submit" className="admin-add-button">
              追加する
            </button>
          </form>

          {gates.length === 0 ? (
            <p className="meta">手書きのパスワードはまだありません。追加すると `/join` から自己登録できます。</p>
          ) : (
            <div className="admin-table-wrap admin-table-wrap-plain">
              <table className="admin-table admin-table-mobile-card admin-table-mobile-cards">
                <thead>
                  <tr>
                    <th>メモ</th>
                    <th>手書きのパスワード</th>
                    <th>状態</th>
                    <th scope="col" className="admin-table-col-actions">
                      削除
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((gate) => (
                    <tr key={gate.gateId} className={gate.isActive ? undefined : "admin-row-inactive"}>
                      <td data-label="メモ">
                        <div className="admin-phrase-line">
                          <span>{gate.label || "—"}</span>
                          <details className="admin-edit-disclosure">
                            <summary className="admin-edit-summary" aria-label="メモ編集を開く">
                              <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
                                edit
                              </span>
                            </summary>
                            <AdminLedgerInlineEditForm action={updateGateLabelAction} className="admin-inline-form admin-inline-form-compact">
                              <input type="hidden" name="gateId" value={gate.gateId} />
                              <input name="label" type="text" lang="ja" autoComplete="off" defaultValue={gate.label} />
                              <button type="submit" className="sr-only" tabIndex={-1}>
                                保存
                              </button>
                            </AdminLedgerInlineEditForm>
                          </details>
                        </div>
                      </td>
                      <td data-label="手書きのパスワード">
                        <div className="admin-phrase-line">
                          <code className="admin-phrase-text">{gate.phrase}</code>
                          <details className="admin-edit-disclosure">
                            <summary className="admin-edit-summary" aria-label="手書きのパスワードの編集を開く">
                              <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
                                edit
                              </span>
                            </summary>
                            <AdminLedgerInlineEditForm action={updateGatePhraseAction} className="admin-inline-form admin-inline-form-compact">
                              <input type="hidden" name="gateId" value={gate.gateId} />
                              <textarea
                                name="phrase"
                                defaultValue={gate.phrase}
                                required
                                rows={1}
                                className="admin-phrase-editor"
                                lang="en"
                                spellCheck={false}
                                title="半角の英数字・記号のみ"
                              />
                              <button type="submit" className="sr-only" tabIndex={-1}>
                                保存
                              </button>
                            </AdminLedgerInlineEditForm>
                          </details>
                        </div>
                      </td>
                      <td data-label="状態">
                        <GateActiveStatusSelect gateId={gate.gateId} isActive={gate.isActive} action={setGateActiveAction} />
                      </td>
                      <td data-label="削除" className="admin-table-cell-actions">
                        <DeleteGateButton gateId={gate.gateId} action={deleteGateAction} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
            <label>
              管理人メモ（任意・ゲストには見えません）
              <textarea name="adminMemo" rows={2} lang="ja" className="admin-phrase-editor" />
            </label>
            <button type="submit" className="admin-add-button">
              追加する
            </button>
          </form>
          <p className="meta">ユーザーIDは登録日時（年月日・時分秒）で自動割り当てされます。秘密の言葉に空白は使えません。</p>
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
                <col className="admin-ledger-col-memo" />
                <col className="admin-ledger-col-phrase" />
                <col className="admin-ledger-col-status" />
                <col className="admin-ledger-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>ユーザーID</th>
                  <th>表示名</th>
                  <th>管理人メモ</th>
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
                    <td data-label="管理人メモ">
                      <div className="admin-phrase-line">
                        <span className="admin-memo-text">{item.adminMemo || "—"}</span>
                        <details className="admin-edit-disclosure">
                          <summary className="admin-edit-summary" aria-label="管理人メモの編集を開く">
                            <span className="material-symbols-outlined admin-nav-icon" aria-hidden="true">
                              edit
                            </span>
                          </summary>
                          <AdminLedgerInlineEditForm action={updateAdminMemoAction} className="admin-inline-form admin-inline-form-compact">
                            <input type="hidden" name="guestId" value={item.guestId} />
                            <textarea
                              name="adminMemo"
                              defaultValue={item.adminMemo}
                              rows={2}
                              className="admin-phrase-editor"
                              lang="ja"
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
