"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { composeLetterAction, type ReplyLetterState } from "@/app/admin/letters/actions";
import { LETTER_BODY_MAX_LENGTH, LETTER_TITLE_MAX_LENGTH } from "@/lib/letters-shared";

const INITIAL: ReplyLetterState = { ok: false };

const REFRESH_EVENT = "admin-notifications-refresh";

export function AdminLettersComposeForm({
  guests
}: {
  guests: { guestId: string; guestName: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(composeLetterAction, INITIAL);
  const [guestId, setGuestId] = useState(guests[0]?.guestId ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!state.ok || !state.slug || !state.guestId) return;
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    router.push(
      `/admin/letters?slug=${encodeURIComponent(state.slug)}&guest=${encodeURIComponent(state.guestId)}`
    );
    router.refresh();
  }, [state, router]);

  if (guests.length === 0) {
    return <p className="meta">宛先にできるゲストがまだいません。</p>;
  }

  return (
    <form action={formAction} className="stack admin-letters-compose-form" aria-busy={pending}>
      <label className="admin-letters-compose-field">
        <span className="admin-letters-field-label">
          <span className="material-symbols-outlined" aria-hidden="true">
            person
          </span>
          宛先
        </span>
        <select name="guestId" value={guestId} onChange={(e) => setGuestId(e.target.value)} required>
          {guests.map((g) => (
            <option key={g.guestId} value={g.guestId}>
              {g.guestName}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-letters-compose-field">
        <span className="admin-letters-field-label">
          <span className="material-symbols-outlined" aria-hidden="true">
            title
          </span>
          件名
        </span>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LETTER_TITLE_MAX_LENGTH}
          placeholder="この往復書簡の名前"
          required
        />
        <span className="admin-letters-field-counter">
          {title.length}/{LETTER_TITLE_MAX_LENGTH}
        </span>
      </label>
      <label className="admin-letters-compose-field">
        <span className="admin-letters-field-label">
          <span className="material-symbols-outlined" aria-hidden="true">
            mail
          </span>
          本文
        </span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          maxLength={LETTER_BODY_MAX_LENGTH}
          placeholder="伝えたいことばを書いてください"
          required
        />
        <span className="admin-letters-field-counter">
          {body.length}/{LETTER_BODY_MAX_LENGTH}
        </span>
      </label>
      <p className="admin-letters-compose-hint">
        <span className="material-symbols-outlined" aria-hidden="true">
          lock
        </span>
        件名は最初の差出人が決め、以降の往復でもそのまま使われます。
      </p>
      {state.error ? (
        <p className="letter-form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="letter-submit-button" disabled={pending}>
        {pending ? "投函しています..." : "投函する"}
      </button>
    </form>
  );
}
