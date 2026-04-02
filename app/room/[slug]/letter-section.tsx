"use client";

import { AppLoadingOverlay } from "@/app/components/app-loading-wave";
import { redirectHomeIfUnauthorized } from "@/lib/redirect-home-if-unauthorized";
import { FormEvent, useEffect, useState } from "react";

type Letter = {
  sender: string;
  body: string;
  createdAt: string;
};

function isAdminSender(sender: string) {
  const normalized = sender.trim().toLowerCase();
  return normalized === "管理者" || normalized === "admin";
}

function toDisplaySender(sender: string) {
  return isAdminSender(sender) ? "管理者" : "あなた";
}

export function LetterSection({
  slug,
  initialLetters,
  guestId,
  autoOpen = false,
  markThreadReadOnOpen = false
}: {
  slug: string;
  initialLetters: Letter[];
  guestId?: string;
  autoOpen?: boolean;
  /** ゲスト本人が文通モーダルを開いたとき、該当スレッドの「返信」通知を既読にする */
  markThreadReadOnOpen?: boolean;
}) {
  const [letters, setLetters] = useState(initialLetters);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !markThreadReadOnOpen) return;
    void fetch("/api/room/notifications/mark-thread-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug })
    }).then((res) => {
      redirectHomeIfUnauthorized(res.status);
      window.dispatchEvent(new CustomEvent("room-notifications-refresh"));
    });
  }, [open, slug, markThreadReadOnOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const guestQuery = guestId ? `?guest=${encodeURIComponent(guestId)}` : "";
      const response = await fetch(`/api/letters/${slug}${guestQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });

      redirectHomeIfUnauthorized(response.status);
      if (!response.ok) return;

      const data = (await response.json()) as { letters: Letter[] };
      setLetters(data.letters);
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" className="letter-open-button" onClick={() => setOpen(true)}>
        この文章をもとに、お手紙を書く
      </button>

      {open ? (
        <div className="letter-modal-backdrop" onClick={() => setOpen(false)}>
          {sending ? <AppLoadingOverlay label="投函中" zIndex={2200} /> : null}
          <section
            className="letters letter-modal"
            role="dialog"
            aria-modal="true"
            aria-label="文通欄"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>往復書簡</h2>
              <button type="button" className="ghost letter-close-button" onClick={() => setOpen(false)} aria-label="閉じる">
                close
              </button>
            </div>
            <p className="meta">このやり取りは あなた と管理者だけに見えます。</p>

            <div className="thread">
              {letters.length === 0 ? <p className="meta">まだ便りはありません。</p> : null}
              {letters.map((letter, index) => {
                const isAdmin = isAdminSender(letter.sender);
                return (
                <article key={`${letter.createdAt}-${index}`} className={`letter-item ${isAdmin ? "is-admin" : "is-you"}`}>
                  <p className="sender">{toDisplaySender(letter.sender)}</p>
                  <p>{letter.body}</p>
                </article>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="stack">
              <p className="meta">お手持ちのメモアプリで整えてから、投函してみましょう。</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="作品を読んだあとに残ったことば"
                required
              />
              <button type="submit" className="letter-submit-button" disabled={sending}>
                {sending ? "投函しています..." : "投函する"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
