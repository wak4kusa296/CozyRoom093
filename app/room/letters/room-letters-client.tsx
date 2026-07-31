"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLoadingOverlay } from "@/app/components/app-loading-wave";
import { LetterSection } from "@/app/room/[slug]/letter-section";
import { redirectHomeIfUnauthorized } from "@/lib/redirect-home-if-unauthorized";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { LETTER_BODY_MAX_LENGTH, LETTER_TITLE_MAX_LENGTH, type Letter } from "@/lib/letters-shared";
import { formatSiteDateTime } from "@/lib/site-datetime";

export type RoomLetterThreadItem = {
  slugKey: string;
  contentSlug: string;
  title: string;
  count: number;
  latestAt: string | null;
  latestBody: string | null;
  latestIsAdmin: boolean;
  unreadCount: number;
  initialLetters: Letter[];
};

export function RoomLettersClient({
  guestId,
  markThreadReadOnOpen,
  threads,
  autoOpenCompose = false,
  initialOpenSlug = null
}: {
  guestId?: string;
  markThreadReadOnOpen: boolean;
  threads: RoomLetterThreadItem[];
  autoOpenCompose?: boolean;
  /** 一覧から開くスレッド */
  initialOpenSlug?: string | null;
}) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => {
    if (!initialOpenSlug) return null;
    return initialOpenSlug;
  });
  const [composeOpen, setComposeOpen] = useState(autoOpenCompose);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [pendingThread, setPendingThread] = useState<RoomLetterThreadItem | null>(null);
  const composeDialogRef = useRef<HTMLElement>(null);

  function closeCompose(): void {
    if (sending) return;
    if ((composeTitle.trim() || composeBody.trim()) && !window.confirm("入力中のお手紙を破棄して閉じますか？")) return;
    setComposeOpen(false);
    setComposeError(null);
  }

  useFocusTrap(composeDialogRef, composeOpen, closeCompose);

  useEffect(() => {
    if (!composeOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [composeOpen]);

  const selectedThread =
    pendingThread &&
    (pendingThread.slugKey === selectedSlug || pendingThread.contentSlug === selectedSlug)
      ? pendingThread
      : selectedSlug
        ? threads.find((t) => t.slugKey === selectedSlug || t.contentSlug === selectedSlug) ?? null
        : null;

  async function onComposeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!composeTitle.trim() || !composeBody.trim()) return;
    setSending(true);
    setComposeError(null);
    try {
      const response = await fetch("/api/letters/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: composeTitle,
          body: composeBody,
          guestId
        })
      });
      redirectHomeIfUnauthorized(response.status);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setComposeError(data?.error?.message ?? "送信に失敗しました。もう一度お試しください。");
        return;
      }
      const data = (await response.json()) as {
        slug?: string;
        title?: string;
        letters?: Letter[];
      };
      setComposeOpen(false);
      setComposeTitle("");
      setComposeBody("");
      if (data.slug) {
        setPendingThread({
          slugKey: data.slug,
          contentSlug: data.slug,
          title: data.title?.trim() || data.slug,
          count: data.letters?.length ?? 1,
          latestAt: data.letters?.[data.letters.length - 1]?.createdAt ?? null,
          latestBody: data.letters?.[data.letters.length - 1]?.body ?? null,
          latestIsAdmin: false,
          unreadCount: 0,
          initialLetters: data.letters ?? []
        });
        setSelectedSlug(data.slug);
      }
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="room-letters-compose" aria-labelledby="room-letters-compose-heading">
        <div className="letters-section-heading">
          <span className="material-symbols-outlined letters-section-icon" aria-hidden="true">
            edit_square
          </span>
          <div>
            <p className="letters-section-kicker">WRITE</p>
            <h2 id="room-letters-compose-heading">新しく手紙を書く</h2>
            <p className="letters-section-lead">
              件名は最初の差出人が決めます。記事に紐づかないお手紙を書けます。
            </p>
          </div>
        </div>
        <button type="button" className="letter-open-button" onClick={() => setComposeOpen(true)}>
          新しく手紙を書く
        </button>
      </section>

      <section className="room-letters-inbox" aria-labelledby="room-letters-inbox-heading">
        <div className="letters-section-heading">
          <span className="material-symbols-outlined letters-section-icon" aria-hidden="true">
            mark_email_read
          </span>
          <div>
            <p className="letters-section-kicker">ARCHIVE</p>
            <h2 id="room-letters-inbox-heading">今までの文通を見る</h2>
            <p className="letters-section-lead">
              お手紙や、各記事の往復書簡をまとめて確認できます。
            </p>
          </div>
        </div>

        {threads.length === 0 ? (
          <p className="meta">まだ文通はありません。</p>
        ) : (
          <ul className="room-letters-thread-list">
            {threads.map((thread) => {
              const preview = thread.latestBody?.trim() || "（本文なし）";
              const previewShort = preview.length > 80 ? `${preview.slice(0, 80)}…` : preview;
              return (
                <li key={thread.slugKey}>
                  <button
                    type="button"
                    className="room-letters-thread-card"
                    onClick={() => setSelectedSlug(thread.contentSlug)}
                  >
                    <span className="room-letters-thread-topline">
                      <span className="room-letters-thread-title">{thread.title}</span>
                      <span className="room-letters-thread-topline-end">
                        {thread.unreadCount > 0 ? (
                          <span className="room-letters-thread-badge" aria-label={`未読${thread.unreadCount}件`}>
                            {thread.unreadCount}
                          </span>
                        ) : null}
                        <span className="room-letters-thread-meta">{thread.count}通</span>
                      </span>
                    </span>
                    <span className="room-letters-thread-preview">
                      <span className="room-letters-thread-sender">
                        {thread.latestIsAdmin ? "管理人" : "あなた"}
                      </span>
                      <span>{previewShort}</span>
                    </span>
                    {thread.latestAt ? (
                      <span className="room-letters-thread-when">{formatSiteDateTime(thread.latestAt)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {composeOpen ? (
        <div className="letter-modal-backdrop" onClick={closeCompose}>
          {sending ? <AppLoadingOverlay label="投函中" zIndex={2200} /> : null}
          <section
            ref={composeDialogRef}
            className="letters letter-modal"
            role="dialog"
            aria-modal="true"
            aria-label="新しいお手紙"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>新しいお手紙</h2>
              <button
                type="button"
                className="ghost letter-close-button"
                onClick={closeCompose}
                aria-label="閉じる"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <p className="meta">件名は最初の差出人が決め、この往復書簡の名前になります。</p>
            <form onSubmit={onComposeSubmit} className="stack">
              <label className="room-letters-compose-field">
                <span className="room-letters-compose-label">件名</span>
                <input
                  type="text"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  maxLength={LETTER_TITLE_MAX_LENGTH}
                  placeholder="この往復書簡の名前"
                  required
                />
                <span className="letters-field-counter">
                  {composeTitle.length}/{LETTER_TITLE_MAX_LENGTH}
                </span>
              </label>
              <label className="room-letters-compose-field">
                <span className="room-letters-compose-label">本文</span>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={5}
                  maxLength={LETTER_BODY_MAX_LENGTH}
                  placeholder="いま伝えたいことば"
                  required
                />
                <span className="letters-field-counter">
                  {composeBody.length}/{LETTER_BODY_MAX_LENGTH}
                </span>
              </label>
              {composeError ? (
                <p className="letter-form-error" role="alert">
                  {composeError}
                </p>
              ) : null}
              <button type="submit" className="letter-submit-button" disabled={sending}>
                {sending ? "投函しています..." : "投函する"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {selectedThread ? (
        <LetterSection
          key={selectedThread.slugKey}
          slug={selectedThread.contentSlug}
          initialLetters={selectedThread.initialLetters}
          guestId={guestId}
          autoOpen
          hideOpenButton
          markThreadReadOnOpen={markThreadReadOnOpen}
          threadTitle={selectedThread.title}
          placeholder="この往復書簡へのことば"
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSlug(null);
              setPendingThread(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
