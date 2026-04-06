"use client";

import { AppLoadingOverlay } from "@/app/components/app-loading-wave";
import { RoomBrand } from "@/app/components/room-brand";
import Link from "next/link";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { FormEvent, useEffect, useRef, useState } from "react";

export function HomePageClient() {
  const [phrase, setPhrase] = useState("");
  const [hintName, setHintName] = useState("");
  const [hintPlace, setHintPlace] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [recoverModalOpen, setRecoverModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [entering, setEntering] = useState(false);
  const recoveryDialogRef = useRef<HTMLElement>(null);

  useFocusTrap(recoveryDialogRef, recoverModalOpen, closeRecoverModal);

  useEffect(() => {
    if (!recoverModalOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [recoverModalOpen]);

  async function enterRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setEntering(true);
    try {
      const response = await fetch("/api/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase })
      });

      if (response.ok) {
        window.location.href = "/room";
        return;
      }

      setMessage("秘密の言葉が違うようです");
    } finally {
      setEntering(false);
    }
  }

  async function sendRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSending(true);

    try {
      const response = await fetch("/api/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hintName, hintPlace, contactEmail })
      });

      if (response.ok) {
        setMessage("受け取りました。確認します。");
        setRecoverModalOpen(false);
        setHintName("");
        setHintPlace("");
        setContactEmail("");
        return;
      }

      setMessage("まだ届けられませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setSending(false);
    }
  }

  function closeRecoverModal() {
    setRecoverModalOpen(false);
    setHintName("");
    setHintPlace("");
    setContactEmail("");
  }

  return (
    <main className="landing">
      {entering ? <AppLoadingOverlay label="入室処理中" /> : null}
      {sending ? <AppLoadingOverlay label="送信中" zIndex={2100} /> : null}
      <section className="card">
        <RoomBrand variant="landing" />

        <form onSubmit={enterRoom} className="stack">
          <label htmlFor="phrase" className="sr-only">
            秘密の言葉
          </label>
          <input
            id="phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="秘密の言葉"
            autoComplete="off"
            required
          />
          <button type="submit">入室する</button>
        </form>

        <nav className="landing-secondary-actions" aria-label="その他">
          <button type="button" className="text-link" onClick={() => setRecoverModalOpen(true)}>
            秘密の言葉を忘れた方へ
          </button>
          <Link href="/admin" className="text-link">
            管理人向け
          </Link>
        </nav>

        {message && <p className="message">{message}</p>}
      </section>

      {recoverModalOpen ? (
        <div className="recovery-modal-backdrop" onClick={closeRecoverModal}>
          <section
            ref={recoveryDialogRef}
            className="recovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="recovery-modal-header">
              <h2 id="recovery-modal-title">秘密の言葉を問い合わせる</h2>
              <button type="button" className="recovery-modal-close-btn" onClick={closeRecoverModal} aria-label="閉じる">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <p className="meta recovery-modal-lead">
              管理人が分かる内容を入力してください。再発行のご案内は、下記のメールアドレス宛に手動でお送りします。
            </p>
            <form onSubmit={sendRecovery} className="stack recovery-modal-form">
              <label className="recovery-modal-label">
                管理人が分かるであろう自分の呼び名
                <input
                  value={hintName}
                  onChange={(e) => setHintName(e.target.value)}
                  required
                  disabled={sending}
                  autoComplete="off"
                />
              </label>
              <label className="recovery-modal-label">
                管理人と一番関わった場面
                <textarea
                  value={hintPlace}
                  onChange={(e) => setHintPlace(e.target.value)}
                  required
                  disabled={sending}
                  rows={3}
                  className="recovery-modal-textarea"
                />
              </label>
              <label className="recovery-modal-label">
                再発行のご案内を受け取るメールアドレス
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  disabled={sending}
                  autoComplete="email"
                  inputMode="email"
                />
              </label>
              <div className="recovery-modal-actions">
                <button type="submit" className="recovery-modal-submit" disabled={sending}>
                  {sending ? "送信中…" : "送信する"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
