"use client";

import { readAdminJson } from "@/lib/admin-read-json";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArticleStylePushLink } from "@/app/components/article-style-push-link";
import { RoomNotificationPanelPreview } from "./room-notification-panel-preview";
import { formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";

export type PushFormGuestOption = {
  guestId: string;
  guestName: string;
};

type Audience = "all" | "selected";

const APP_LABEL = "誰も知らない部屋";

function formatPreviewNow() {
  return formatSiteDateTimeWithSeconds(new Date().toISOString());
}

export function PushBroadcastForm({ guests }: { guests: PushFormGuestOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewTime = useMemo(() => formatPreviewNow(), []);

  const sortedGuests = useMemo(() => {
    return [...guests].sort((a, b) => {
      const na = a.guestName.trim() || a.guestId;
      const nb = b.guestName.trim() || b.guestId;
      const c = na.localeCompare(nb, "ja");
      return c !== 0 ? c : a.guestId.localeCompare(b.guestId, "ja");
    });
  }, [guests]);

  const titlePv = title.trim() || "（タイトル）";
  const leadPv = lead.trim();
  const bodyPv = body.trim() || "（本文を入力するとプレビューに反映されます）";
  const linkPv = linkUrl.trim();
  const labelPv = linkLabel.trim() || "開く";
  const imgPv = imageUrl.trim();
  const showImgPv = /^(\/|https?:\/\/)/i.test(imgPv);
  /** スマホ通知2行目＝リード文（未入力時は案内のみ） */
  const phoneLine2 = leadPv || "（リード文を入力すると表示されます）";

  function toggleGuest(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllRecipients() {
    setSelectedIds(new Set(sortedGuests.map((g) => g.guestId)));
  }

  function clearRecipients() {
    setSelectedIds(new Set());
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/push-asset", { method: "POST", credentials: "include", body: fd });
      const data = await readAdminJson<{ ok?: boolean; url?: string; error?: string }>(res);
      if (!res.ok || !data.ok || !data.url) {
        setMessage(
          data.error === "too_large"
            ? "画像は2.5MB以下にしてください。"
            : data.error === "bad_type"
              ? "JPEG / PNG / WebP / GIF のみです。"
              : data.error === "write_failed"
                ? "サーバーに保存できませんでした。本番ホストでは書き込み不可のことがあります。"
                : "画像のアップロードに失敗しました。"
        );
        return;
      }
      setImageUrl(data.url);
    } catch {
      setMessage("画像のアップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const leadTrim = lead.trim();
    if (!leadTrim) {
      setMessage("リード文が必要です。");
      return;
    }
    setPending(true);
    try {
      const guestIds = audience === "selected" ? [...selectedIds] : [];
      const res = await fetch("/api/admin/broadcast-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          audience,
          guestIds,
          lead: leadTrim,
          imageUrl: imageUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined
        })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        webPush?: {
          skippedReason: "vapid_not_configured" | null;
          targetCount: number;
          sentCount: number;
          failureCount: number;
        };
      };
      if (!res.ok || !data.ok) {
        if (data.error === "invalid_body") setMessage("タイトルと本文が必要です。");
        else if (data.error === "lead_required") setMessage("リード文が必要です。");
        else if (data.error === "guests_required") setMessage("宛先を1人以上選んでください。");
        else if (data.error === "unknown_guest") setMessage("宛先が無効です。再読み込みしてください。");
        else setMessage("送信に失敗しました。");
        return;
      }
      let detail = "";
      const wp = data.webPush;
      if (wp) {
        if (wp.skippedReason === "vapid_not_configured") {
          detail =
            " Web Push は VAPID 鍵（NEXT_PUBLIC_VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY）が未設定のため送れませんでした。Vercel の環境変数を確認してください。";
        } else if (wp.targetCount === 0) {
          detail =
            " Web Push: 購読端末がありません。ゲストがルームで「通知を許可する」を押すと届きます。";
        } else if (wp.sentCount > 0 && wp.failureCount === 0) {
          detail = ` Web Push: ${wp.sentCount} 件送信しました。`;
        } else if (wp.sentCount > 0 && wp.failureCount > 0) {
          detail = ` Web Push: ${wp.sentCount} 件成功、${wp.failureCount} 件失敗しました。`;
        } else if (wp.failureCount > 0) {
          detail = ` Web Push: ${wp.failureCount} 件失敗しました（購読の期限切れやネットワークを確認してください）。`;
        }
      }
      setMessage(`送信しました。${detail}`);
      setTitle("");
      setLead("");
      setBody("");
      setImageUrl("");
      setLinkUrl("");
      setLinkLabel("");
      setAudience("all");
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      setMessage("送信に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="room-push-layout">
      <form className="room-push-editor" onSubmit={onSubmit}>
        <section className="room-push-section">
          <div className="room-push-field room-push-field--inline">
            <div className="room-push-seg" role="group" aria-label="配信範囲">
              <button
                type="button"
                className={`room-push-seg-btn${audience === "all" ? " is-active" : ""}`}
                onClick={() => setAudience("all")}
                disabled={pending}
              >
                全員
              </button>
              <button
                type="button"
                className={`room-push-seg-btn${audience === "selected" ? " is-active" : ""}`}
                onClick={() => setAudience("selected")}
                disabled={pending}
              >
                指定
              </button>
            </div>
          </div>

          {audience === "selected" ? (
            <div className="room-push-recipients">
              <div className="room-push-recipients-toolbar">
                <span className="room-push-recipients-hint">タップで選択（複数可）</span>
                <div className="room-push-recipients-actions">
                  <button
                    type="button"
                    className="room-push-tool-btn"
                    onClick={selectAllRecipients}
                    disabled={pending || sortedGuests.length === 0}
                  >
                    すべて選択
                  </button>
                  <button
                    type="button"
                    className="room-push-tool-btn"
                    onClick={clearRecipients}
                    disabled={pending || selectedIds.size === 0}
                  >
                    クリア
                  </button>
                </div>
                <span className="room-push-recipients-count">{selectedIds.size} 名</span>
              </div>
              {sortedGuests.length === 0 ? (
                <p className="room-push-muted">ゲストがありません</p>
              ) : (
                <ul className="room-push-recipient-list" aria-label="送信相手">
                  {sortedGuests.map((g) => {
                    const on = selectedIds.has(g.guestId);
                    const label = g.guestName.trim() || g.guestId;
                    return (
                      <li key={g.guestId}>
                        <button
                          type="button"
                          className={`room-push-recipient-row${on ? " is-selected" : ""}`}
                          aria-pressed={on}
                          disabled={pending}
                          title={`ID: ${g.guestId}`}
                          onClick={() => toggleGuest(g.guestId)}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <section className="room-push-section">
          <label className="room-push-field">
            <span className="room-push-label">タイトル</span>
            <input
              className="room-push-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="必須"
              autoComplete="off"
              disabled={pending}
            />
          </label>
          <label className="room-push-field">
            <span className="room-push-label">リード文</span>
            <input
              className="room-push-input"
              type="text"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              placeholder="必須（一覧の補足・スマホ通知2行目）"
              autoComplete="off"
              required
              disabled={pending}
            />
          </label>
          <label className="room-push-field">
            <span className="room-push-label">本文</span>
            <textarea
              className="room-push-textarea"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="必須（モーダルに全文表示）"
              disabled={pending}
            />
          </label>
        </section>

        <details className="room-push-more">
          <summary>画像・リンク</summary>
          <div className="room-push-field">
            <span className="room-push-label">画像</span>
            <div className="room-push-upload">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="room-push-file-input"
                onChange={onImageChange}
                disabled={pending || uploading}
              />
              <button
                type="button"
                className="room-push-upload-btn"
                onClick={() => fileRef.current?.click()}
                disabled={pending || uploading}
              >
                {uploading ? "アップロード中…" : "ファイルを選ぶ"}
              </button>
              {imgPv ? (
                <button
                  type="button"
                  className="room-push-linkish"
                  onClick={() => setImageUrl("")}
                  disabled={pending || uploading}
                >
                  削除
                </button>
              ) : null}
            </div>
            {imgPv && showImgPv ? (
              <div className="room-push-upload-preview">
                <img src={imgPv} alt="" className="room-push-upload-thumb" />
              </div>
            ) : null}
          </div>

          <div className="room-push-field-row">
            <label className="room-push-field room-push-field--grow">
              <span className="room-push-label">リンク URL</span>
              <input
                className="room-push-input"
                type="text"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="任意"
                autoComplete="off"
                disabled={pending}
              />
            </label>
            <label className="room-push-field room-push-field--grow">
              <span className="room-push-label">リンク名</span>
              <input
                className="room-push-input"
                type="text"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="既定「開く」"
                autoComplete="off"
                disabled={pending}
              />
            </label>
          </div>
        </details>

        <button type="submit" className="room-push-submit" disabled={pending || uploading}>
          {pending ? "送信中…" : "送信"}
        </button>
        {message ? (
          <p className="room-push-msg" role="status">
            {message}
          </p>
        ) : null}
      </form>

      <aside className="room-push-sim" aria-label="見え方のシミュレーション">
        <section className="room-push-sim-section">
          <h3 className="room-push-sim-h">ルーム通知パネル</h3>
          <p className="room-push-sim-note">RoomNotificationBell と同じ DOM（操作は無効）</p>
          <RoomNotificationPanelPreview title={titlePv} lead={leadPv || undefined} whenLabel={previewTime} />
          <h4 className="room-push-sim-subh">タップ後のモーダル</h4>
          <div className="room-push-sim-modal">
            <div className="room-notification-push-dialog-inner">
              <h3 className="room-notification-push-dialog-title">{titlePv}</h3>
              {leadPv ? (
                <p className="room-notification-push-dialog-subtitle">{leadPv}</p>
              ) : null}
              <p className="room-notification-push-dialog-meta">{previewTime}</p>
              {showImgPv ? (
                <div className="room-notification-push-dialog-image-wrap">
                  <img src={imgPv} alt="" className="room-notification-push-dialog-image" />
                </div>
              ) : null}
              <div className="room-notification-push-dialog-body">{bodyPv}</div>
              {linkPv ? (
                <ArticleStylePushLink href={linkPv} preview>
                  {labelPv}
                </ArticleStylePushLink>
              ) : null}
            </div>
          </div>
        </section>

        <section className="room-push-sim-section">
          <h3 className="room-push-sim-h">スマホ通知バー（イメージ）</h3>
          <p className="room-push-sim-note">
            2行目はリード文です。OSの実通知ではありません。
          </p>
          <div className="room-push-phone">
            <div className="room-push-phone-bar">
              <span>9:41</span>
              <span className="room-push-phone-icons" aria-hidden="true">
                ···
              </span>
            </div>
            <div className="room-push-phone-toast" role="presentation">
              <span className="material-symbols-outlined room-push-phone-ico" aria-hidden="true">
                notifications
              </span>
              <div className="room-push-phone-text">
                <span className="room-push-phone-app">{APP_LABEL}</span>
                <span className="room-push-phone-t1">{titlePv}</span>
                <span className={`room-push-phone-t2${leadPv ? "" : " is-placeholder"}`}>
                  {phoneLine2}
                </span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
