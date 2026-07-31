"use client";

import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps
} from "react";
import { createPortal } from "react-dom";

type AdminDeleteConfirmDialogProps = {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AdminDeleteConfirmDialog({
  open,
  message,
  title = "削除の確認",
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  onCancel,
  onConfirm
}: AdminDeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useFocusTrap(dialogRef, open, onCancel);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="admin-delete-confirm-backdrop" onClick={onCancel}>
      <section
        ref={dialogRef}
        className="admin-delete-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-delete-confirm-title"
        aria-describedby="admin-delete-confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="admin-delete-confirm-title">{title}</h2>
        <p id="admin-delete-confirm-message" className="admin-delete-confirm-message">
          {message}
        </p>
        <div className="admin-delete-confirm-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="admin-delete-confirm-submit" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

type AdminDeleteConfirmFormProps = {
  action: ComponentProps<"form">["action"];
  message: string;
  title?: string;
  confirmLabel?: string;
  className?: string;
  children: ReactNode;
  /** 確認後・送信直前に呼ぶ（楽観的 UI 更新用） */
  onConfirmed?: () => void;
  onOpenChange?: (open: boolean) => void;
};

/** 送信前に確認ダイアログを出し、「削除する」で初めて action を実行する form */
export function AdminDeleteConfirmForm({
  action,
  message,
  title,
  confirmLabel,
  className,
  children,
  onConfirmed,
  onOpenChange
}: AdminDeleteConfirmFormProps) {
  const [open, setOpen] = useState(false);
  const allowSubmitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function setConfirmOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false;
      return;
    }
    event.preventDefault();
    setConfirmOpen(true);
  }

  return (
    <>
      <form ref={formRef} action={action} className={className} onSubmit={handleSubmit}>
        {children}
      </form>
      <AdminDeleteConfirmDialog
        open={open}
        message={message}
        title={title}
        confirmLabel={confirmLabel}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          onConfirmed?.();
          allowSubmitRef.current = true;
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}

/** 非同期削除など、form 以外から確認を取るとき用 */
export function useAdminDeleteConfirm() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState<string | undefined>(undefined);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmDelete = useCallback((nextMessage: string, nextTitle?: string) => {
    setMessage(nextMessage);
    setTitle(nextTitle);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const deleteConfirmDialog = (
    <AdminDeleteConfirmDialog
      open={open}
      message={message}
      title={title}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirmDelete, deleteConfirmDialog, isConfirmOpen: open };
}
