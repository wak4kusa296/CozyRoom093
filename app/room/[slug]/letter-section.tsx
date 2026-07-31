"use client";

import { AppLoadingOverlay } from "@/app/components/app-loading-wave";
import { redirectHomeIfUnauthorized } from "@/lib/redirect-home-if-unauthorized";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ADMIN_DISPLAY_NAME, LETTER_BODY_MAX_LENGTH, type Letter } from "@/lib/letters-shared";
import { formatSiteDateTime } from "@/lib/site-datetime";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

export function LetterSection({
  slug,
  initialLetters,
  guestId,
  autoOpen = false,
  markThreadReadOnOpen = false,
  openButtonId,
  placeholder = "作品を読んだあとに残ったことば",
  hideOpenButton = false,
  threadTitle,
  viewerRole = "guest",
  counterpartName,
  headerExtra,
  onOpenChange
}: {
  slug: string;
  initialLetters: Letter[];
  guestId?: string;
  autoOpen?: boolean;
  /** ゲスト本人が文通モーダルを開いたとき、該当スレッドの「返信」通知を既読にする */
  markThreadReadOnOpen?: boolean;
  openButtonId?: string;
  placeholder?: string;
  hideOpenButton?: boolean;
  threadTitle?: string;
  viewerRole?: "admin" | "guest";
  counterpartName?: string;
  headerExtra?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [letters, setLetters] = useState(initialLetters);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const setOpenState = useCallback((next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  function requestClose(): void {
    if (sending) return;
    if (viewerRole === "guest" && body.trim() && !window.confirm("入力中の本文を破棄して閉じますか？")) return;
    setOpenState(false);
  }

  useFocusTrap(dialogRef, open, requestClose);

  useEffect(() => {
    setLetters(initialLetters);
  }, [initialLetters]);

  useEffect(() => {
    if (autoOpen) setOpenState(true);
  }, [autoOpen, setOpenState]);

  useEffect(() => {
    if (!open) return;
    const guestQuery = guestId ? `?guest=${encodeURIComponent(guestId)}` : "";
    void (async () => {
      const res = await fetch(`/api/letters/${encodeURIComponent(slug)}${guestQuery}`, { cache: "no-store" });
      redirectHomeIfUnauthorized(res.status);
      if (!res.ok) return;
      const data = (await res.json()) as { letters?: Letter[] };
      setLetters(data.letters ?? []);
    })();
  }, [open, slug, guestId]);

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
    setError(null);
    try {
      const guestQuery = guestId ? `?guest=${encodeURIComponent(guestId)}` : "";
      const response = await fetch(`/api/letters/${slug}${guestQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });

      redirectHomeIfUnauthorized(response.status);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(data?.error?.message ?? "送信に失敗しました。もう一度お試しください。");
        return;
      }

      const data = (await response.json()) as { letters: Letter[] };
      setLetters(data.letters);
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {hideOpenButton ? null : <button id={openButtonId} type="button" className="letter-open-button" onClick={() => setOpenState(true)}>この文章をもとに、お手紙を書く</button>}

      {open ? (
        <div className="letter-modal-backdrop" onClick={requestClose}>
          {sending ? <AppLoadingOverlay label="投函中" zIndex={2200} /> : null}
          <section
            ref={dialogRef}
            className="letters letter-modal"
            role="dialog"
            aria-modal="true"
            aria-label="文通欄"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>{threadTitle?.trim() || "往復書簡"}</h2>
              {headerExtra}
              <button type="button" className="ghost letter-close-button" onClick={requestClose} aria-label="閉じる">
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <p className="meta">このやり取りは {viewerRole === "admin" ? counterpartName?.trim() || "ゲスト" : "あなた"} と{ADMIN_DISPLAY_NAME}だけに見えます。</p>

            <div className="thread">
              {letters.length === 0 ? <p className="meta">まだ便りはありません。</p> : null}
              {letters.map((letter, index) => {
                const isAdmin = letter.senderRole === "admin";
                return (
                <article key={`${letter.id}-${index}`} className={`letter-item ${isAdmin ? "is-admin" : "is-you"}`}>
                  <p className="sender">{isAdmin ? ADMIN_DISPLAY_NAME : viewerRole === "admin" ? counterpartName?.trim() || "ゲスト" : "あなた"}</p>
                  <p>{letter.body}</p>
                  <time className="meta" dateTime={letter.createdAt}>{formatSiteDateTime(letter.createdAt)}</time>
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
                maxLength={LETTER_BODY_MAX_LENGTH}
                placeholder={placeholder}
                required
              />
              <p className="meta">{body.length}/{LETTER_BODY_MAX_LENGTH}</p>
              {error ? <p className="letter-form-error" role="alert">{error}</p> : null}
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
