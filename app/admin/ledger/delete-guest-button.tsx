"use client";

import { useFormStatus } from "react-dom";
import { deleteGuestAction } from "./actions";

function SubmitIcon() {
  const { pending } = useFormStatus();
  return (
    <span
      className={`material-symbols-outlined admin-delete-guest-icon${pending ? " admin-delete-guest-icon--pending" : ""}`}
      aria-hidden="true"
    >
      delete
    </span>
  );
}

export function DeleteGuestButton({ guestId }: { guestId: string }) {
  return (
    <form
      action={deleteGuestAction}
      className="admin-delete-guest-form"
      onSubmit={(e) => {
        if (
          !confirm(
            "このユーザーを削除しますか？\n手紙・プッシュ購読・ハートの記録など、関連データもまとめて消えます。"
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="guestId" value={guestId} />
      <button type="submit" className="admin-delete-guest-button" aria-label={`${guestId} を削除`} title="ユーザーを削除">
        <SubmitIcon />
      </button>
    </form>
  );
}
