"use client";

import { AppLoadingOverlay } from "@/app/components/app-loading-wave";
import { RoomBrand } from "@/app/components/room-brand";
import {
  HANDWRITTEN_PASSWORD_INVALID_MESSAGE,
  isValidHandwrittenPassword,
  isValidSecretPhrase,
  PHRASE_ENTER_AS_SHOWN_HINT,
  SECRET_PHRASE_RULE_HINT,
  SECRET_PHRASE_WHITESPACE_MESSAGE,
  secretPhraseContainsWhitespace
} from "@/lib/passphrase-rules";
import { PHRASE_TAKEN_MESSAGE } from "@/lib/signup-email-template";
import Link from "next/link";
import { FormEvent, useState } from "react";

type SuccessState = {
  guestName: string;
  phrase: string;
  emailSent: boolean;
};

export function JoinPageClient() {
  const [gatePhrase, setGatePhrase] = useState("");
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [memo, setMemo] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phrase, setPhrase] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [checkingPhrase, setCheckingPhrase] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  function validateGatePhrase(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setGateError(null);
      return true;
    }
    if (!isValidHandwrittenPassword(trimmed)) {
      setGateError(HANDWRITTEN_PASSWORD_INVALID_MESSAGE);
      return false;
    }
    setGateError(null);
    return true;
  }

  /** 1文字でも入っていれば前後含む空白を即時チェック */
  function syncSecretPhraseWhitespaceError(value: string) {
    if (value.length === 0) {
      setPhraseError(null);
      return true;
    }
    if (secretPhraseContainsWhitespace(value)) {
      setPhraseError(SECRET_PHRASE_WHITESPACE_MESSAGE);
      return false;
    }
    setPhraseError((prev) => (prev === SECRET_PHRASE_WHITESPACE_MESSAGE ? null : prev));
    return true;
  }

  async function checkPhraseAvailability(value: string) {
    if (value.length === 0) {
      setPhraseError(null);
      return;
    }
    if (!syncSecretPhraseWhitespaceError(value)) {
      return;
    }
    setCheckingPhrase(true);
    try {
      const res = await fetch("/api/join/check-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: value })
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { available?: boolean; message?: string };
      if (data.available === false) {
        setPhraseError(data.message?.trim() || PHRASE_TAKEN_MESSAGE);
      } else {
        setPhraseError(null);
      }
    } catch {
      setFormError("秘密の言葉を確認できませんでした。接続を確認して、もう一度お試しください。");
    } finally {
      setCheckingPhrase(false);
    }
  }

  async function onVerifyGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checkingGate) return;
    setFormError(null);

    if (!validateGatePhrase(gatePhrase)) {
      setFormError(HANDWRITTEN_PASSWORD_INVALID_MESSAGE);
      return;
    }
    if (!gatePhrase.trim()) {
      setFormError("手書きのパスワードを入力してください。");
      return;
    }

    setCheckingGate(true);
    try {
      const res = await fetch("/api/join/check-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatePhrase })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (res.status === 400 && data.error === "invalid_gate_format") {
        const msg = data.message?.trim() || HANDWRITTEN_PASSWORD_INVALID_MESSAGE;
        setGateError(msg);
        setFormError(msg);
        return;
      }
      if (res.status === 403 || data.error === "invalid_gate") {
        const msg = data.message?.trim() || "手書きのパスワードが違うか、無効になっています。";
        setGateError(msg);
        setFormError(msg);
        return;
      }
      if (!res.ok || !data.ok) {
        setFormError("確認できませんでした。もう一度お試しください。");
        return;
      }

      setGateUnlocked(true);
      setGateError(null);
      setFormError(null);
    } catch {
      setFormError("通信できませんでした。接続を確認して、もう一度お試しください。");
    } finally {
      setCheckingGate(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || checkingGate) return;
    setFormError(null);

    if (!gateUnlocked) {
      setFormError("先に手書きのパスワードを確認してください。");
      return;
    }
    if (!validateGatePhrase(gatePhrase)) {
      setFormError(HANDWRITTEN_PASSWORD_INVALID_MESSAGE);
      return;
    }
    if (!isValidSecretPhrase(phrase)) {
      const msg = secretPhraseContainsWhitespace(phrase)
        ? SECRET_PHRASE_WHITESPACE_MESSAGE
        : "秘密の言葉を入力してください。";
      setPhraseError(msg);
      setFormError(msg);
      return;
    }
    if (phraseError) {
      setFormError(phraseError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatePhrase,
          guestName,
          memo,
          contactEmail,
          phrase
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        guestName?: string;
        phrase?: string;
        emailSent?: boolean;
      };

      if (res.status === 409 || data.error === "phrase_taken") {
        const msg = data.message?.trim() || PHRASE_TAKEN_MESSAGE;
        setPhraseError(msg);
        setFormError(msg);
        return;
      }
      if (res.status === 400 && data.error === "invalid_phrase_whitespace") {
        const msg = data.message?.trim() || SECRET_PHRASE_WHITESPACE_MESSAGE;
        setPhraseError(msg);
        setFormError(msg);
        return;
      }
      if (res.status === 400 && data.error === "invalid_gate_format") {
        const msg = data.message?.trim() || HANDWRITTEN_PASSWORD_INVALID_MESSAGE;
        setGateError(msg);
        setFormError(msg);
        setGateUnlocked(false);
        return;
      }
      if (res.status === 403 || data.error === "invalid_gate") {
        setFormError("手書きのパスワードが違うか、無効になっています。");
        setGateUnlocked(false);
        return;
      }
      if (res.status === 400 && data.error === "invalid_email") {
        setFormError("メールアドレスの形式を確認してください。");
        return;
      }
      if (!res.ok || !data.ok) {
        setFormError("登録できませんでした。入力内容を確認して、もう一度お試しください。");
        return;
      }

      setSuccess({
        guestName: data.guestName ?? guestName.trim(),
        phrase: data.phrase ?? phrase.trim(),
        emailSent: Boolean(data.emailSent)
      });
      setContactEmail("");
    } catch {
      setFormError("通信できませんでした。接続を確認して、もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="landing">
        <section className="card">
          <RoomBrand variant="landing" />
          <h1 className="sr-only">登録完了</h1>
          <p className="lead">登録が完了しました。</p>
          <p className="meta">
            {success.emailSent
              ? "控えのメールを送りました。届かない場合は、下の秘密の言葉を控えてください。"
              : "メールを送れませんでした。下の秘密の言葉を必ず控えてください。"}
          </p>
          <div className="stack join-success-memo" role="status">
            <p>
              <span className="admin-notification-label">呼び名</span> {success.guestName}
            </p>
            <p>
              <span className="admin-notification-label">秘密の言葉</span>
            </p>
            <p className="join-success-phrase">{success.phrase}</p>
            <p className="meta">{PHRASE_ENTER_AS_SHOWN_HINT}</p>
            <p className="meta">入室はトップページから行います。</p>
          </div>
          <p>
            <Link href="/" className="text-link">
              入室ページへ
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const busy = submitting || checkingGate;

  return (
    <main className="landing">
      {busy ? <AppLoadingOverlay label={checkingGate ? "確認中" : "登録中"} /> : null}
      <section className="card">
        <RoomBrand variant="landing" />
        <h1 className="sr-only">新規登録</h1>
        <p className="lead">この部屋への新規登録</p>
        {!gateUnlocked ? (
          <p className="meta">紙に書かれた手書きのパスワードを入力してください。</p>
        ) : (
          <p className="meta">
            呼び名と場面は管理人の確認用で、他のゲストには見えません。メールアドレスは控えの送付にだけ使い、すぐ破棄します。あなたが決める秘密の言葉で、あとから入室できます。
          </p>
        )}

        {!gateUnlocked ? (
          <form onSubmit={onVerifyGate} className="stack recovery-modal-form">
            <label className="recovery-modal-label">
              手書きのパスワード
              <input
                value={gatePhrase}
                onChange={(e) => {
                  setGatePhrase(e.target.value);
                  setGateError(null);
                  setFormError(null);
                }}
                onBlur={() => {
                  validateGatePhrase(gatePhrase);
                }}
                className="ui-field"
                required
                disabled={busy}
                autoComplete="off"
                inputMode="text"
                lang="en"
                spellCheck={false}
                aria-invalid={gateError ? true : undefined}
                aria-describedby={gateError ? "join-gate-error" : undefined}
              />
            </label>
            {gateError ? (
              <p id="join-gate-error" className="join-field-error" role="alert">
                {gateError}
              </p>
            ) : null}

            <div className="recovery-modal-actions">
              <button type="submit" className="recovery-modal-submit ui-button ui-button--primary" disabled={busy || Boolean(gateError)}>
                {checkingGate ? "確認中…" : "次へ"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="stack recovery-modal-form">
            <p className="meta join-gate-confirmed" role="status">
              手書きのパスワードを確認しました。続けて登録内容を入力してください。
            </p>
            <label className="recovery-modal-label">
              管理人が分かるであろう自分の呼び名
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="ui-field"
                required
                disabled={busy}
                autoComplete="nickname"
                lang="ja"
              />
            </label>
            <label className="recovery-modal-label">
              管理人と一番関わった場面
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                required
                disabled={busy}
                rows={3}
                className="recovery-modal-textarea ui-field"
              />
            </label>
            <label className="recovery-modal-label">
              控えを受け取るメールアドレス（管理者は保存しません）
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                disabled={busy}
                autoComplete="email"
                inputMode="email"
                className="ui-field"
              />
            </label>
            <label className="recovery-modal-label">
              希望する秘密の言葉
              <span id="join-phrase-hint" className="join-field-hint">
                {SECRET_PHRASE_RULE_HINT}
              </span>
              <input
                value={phrase}
                onChange={(e) => {
                  const next = e.target.value;
                  setPhrase(next);
                  syncSecretPhraseWhitespaceError(next);
                }}
                onBlur={(e) => void checkPhraseAvailability(e.target.value)}
                required
                disabled={busy}
                autoComplete="off"
                aria-invalid={phraseError ? true : undefined}
                aria-describedby={phraseError ? "join-phrase-error" : "join-phrase-hint"}
                className="ui-field"
              />
            </label>
            {checkingPhrase ? <p className="meta join-field-hint">秘密の言葉を確認しています…</p> : null}
            {phraseError ? (
              <p id="join-phrase-error" className="join-field-error" role="alert">
                {phraseError}
              </p>
            ) : null}

            <div className="recovery-modal-actions">
              <button
                type="submit"
                className="recovery-modal-submit ui-button ui-button--primary"
                disabled={busy || Boolean(phraseError)}
              >
                {submitting ? "登録中…" : "登録する"}
              </button>
            </div>
          </form>
        )}

        {formError ? (
          <p className="message" role="alert">
            {formError}
          </p>
        ) : null}

        <nav className="landing-secondary-actions" aria-label="その他">
          <Link href="/" className="text-link">
            入室ページへ
          </Link>
        </nav>
      </section>
    </main>
  );
}
