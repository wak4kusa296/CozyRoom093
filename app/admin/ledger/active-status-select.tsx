"use client";

import { useFormStatus } from "react-dom";

type ActiveStatusSelectProps = {
  guestId: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function ActiveStatusSelect({ guestId, isActive, action }: ActiveStatusSelectProps) {
  const statusIcon = isActive ? "run_circle" : "block";
  const statusLabel = isActive ? "実行中" : "無効";

  return (
    <form action={action} className="admin-inline-form admin-inline-form-compact">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <StatusButton isActive={isActive} statusIcon={statusIcon} statusLabel={statusLabel} />
    </form>
  );
}

function StatusButton({ isActive, statusIcon, statusLabel }: { isActive: boolean; statusIcon: string; statusLabel: string }) {
  const { pending } = useFormStatus();
  return (
      <button type="submit" className="admin-icon-ghost" aria-label={pending ? "状態を更新中" : isActive ? "無効にする" : "有効にする"} disabled={pending}>
        <span
          className={`material-symbols-outlined admin-toggle-icon ${isActive ? "admin-toggle-icon-active" : "admin-toggle-icon-inactive"}`}
          aria-hidden="true"
        >
          {statusIcon}
        </span>
        <span className="sr-only">{pending ? "状態を更新中…" : statusLabel}</span>
      </button>
  );
}
