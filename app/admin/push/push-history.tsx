"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArticleStylePushLink } from "@/app/components/article-style-push-link";
import { formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";

export type PushHistoryRow = {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  lead?: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
  audience: "all" | "selected";
  guestIds: string[];
};

export function PushHistory({ pushes }: { pushes: PushHistoryRow[] }) {
  const [modal, setModal] = useState<PushHistoryRow | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!modal) return;
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) {
      el.showModal();
    }
  }, [modal]);

  if (pushes.length === 0) {
    return (
      <section className="admin-push-history" aria-labelledby="admin-push-history-heading">
        <h2 id="admin-push-history-heading" className="admin-push-history-title">
          過去のプッシュ通知
        </h2>
        <p className="meta admin-push-history-empty">まだ送信履歴がありません。</p>
      </section>
    );
  }

  const dialog =
    mounted && modal ? (
      <dialog
        ref={dialogRef}
        className="room-notification-push-dialog"
        aria-labelledby="admin-push-history-dialog-title"
        onClose={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            e.currentTarget.close();
          }
        }}
      >
        <div className="room-notification-push-dialog-inner">
          <div className="room-notification-push-dialog-header-row">
            <h3 id="admin-push-history-dialog-title" className="room-notification-push-dialog-title">
              {modal.title}
            </h3>
            <button
              type="button"
              className="room-notification-push-dialog-close"
              aria-label="閉じる"
              onClick={() => dialogRef.current?.close()}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
          {modal.lead ? (
            <p className="room-notification-push-dialog-subtitle">{modal.lead}</p>
          ) : null}
          <p className="room-notification-push-dialog-meta">{formatSiteDateTimeWithSeconds(modal.sentAt)}</p>
          <p className="meta admin-push-history-dialog-audience">
            {modal.audience === "all" ? "配信: 全員" : `配信: 指定ゲスト ${modal.guestIds.length}名`}
          </p>
          {modal.imageUrl ? (
            <div className="room-notification-push-dialog-image-wrap">
              <img src={modal.imageUrl} alt="" className="room-notification-push-dialog-image" />
            </div>
          ) : null}
          <div className="room-notification-push-dialog-body">{modal.body}</div>
          {modal.linkUrl ? (
            <ArticleStylePushLink href={modal.linkUrl}>{modal.linkLabel ?? "開く"}</ArticleStylePushLink>
          ) : null}
        </div>
      </dialog>
    ) : null;

  return (
    <>
      <section className="admin-push-history" aria-labelledby="admin-push-history-heading">
        <h2 id="admin-push-history-heading" className="admin-push-history-title">
          過去のプッシュ通知
        </h2>
        <p className="meta admin-push-history-hint">行をクリックすると、ルーム通知と同じ内容でモーダルを表示します。</p>
        <ul className="admin-push-history-list">
          {pushes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="admin-push-history-row"
                onClick={() => setModal(p)}
              >
                <span className="admin-push-history-date">{formatSiteDateTimeWithSeconds(p.sentAt)}</span>
                <span className="admin-push-history-heading">{p.title}</span>
                {p.lead ? <span className="admin-push-history-lead">{p.lead}</span> : null}
                <span className="admin-push-history-audience">
                  {p.audience === "all" ? "全員" : `指定 ${p.guestIds.length}名`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
