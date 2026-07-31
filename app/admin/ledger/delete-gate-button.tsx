"use client";

import { useFormStatus } from "react-dom";
import { AdminDeleteConfirmForm } from "@/app/admin/admin-delete-confirm";

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

type DeleteGateButtonProps = {
  gateId: string;
  action: (formData: FormData) => Promise<void>;
};

export function DeleteGateButton({ gateId, action }: DeleteGateButtonProps) {
  return (
    <AdminDeleteConfirmForm
      action={action}
      className="admin-delete-guest-form"
      message={"この手書きのパスワードを削除しますか？\n無効化ではなく削除します。"}
      >
      <input type="hidden" name="gateId" value={gateId} />
      <button type="submit" className="admin-delete-guest-button" aria-label={`${gateId} を削除`} title="手書きのパスワードを削除">
        <SubmitIcon />
      </button>
    </AdminDeleteConfirmForm>
  );
}
