"use client";

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
      <button type="submit" className="admin-icon-ghost" aria-label={isActive ? "無効にする" : "有効にする"}>
        <span
          className={`material-symbols-outlined admin-toggle-icon ${isActive ? "admin-toggle-icon-active" : "admin-toggle-icon-inactive"}`}
          aria-hidden="true"
        >
          {statusIcon}
        </span>
        <span className="sr-only">{statusLabel}</span>
      </button>
    </form>
  );
}
