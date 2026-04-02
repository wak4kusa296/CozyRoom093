"use client";

import { useActionState, useEffect } from "react";
import { replyLetterAction, type ReplyLetterState } from "@/app/admin/letters/actions";

const INITIAL: ReplyLetterState = { ok: false };

const REFRESH_EVENT = "admin-notifications-refresh";

export function AdminLettersReplyForm({ children }: { children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(replyLetterAction, INITIAL);

  useEffect(() => {
    if (state.ok) {
      window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    }
  }, [state]);

  return (
    <form action={formAction} className="stack" aria-busy={pending}>
      {children}
      <button type="submit" className="letter-submit-button" disabled={pending}>
        {pending ? "送信中…" : "返信する"}
      </button>
    </form>
  );
}
