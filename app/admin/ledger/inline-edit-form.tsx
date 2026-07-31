"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ServerAction = (formData: FormData) => Promise<void>;

function SaveStatus() {
  const { pending } = useFormStatus();
  return pending ? <span className="sr-only" role="status">保存中…</span> : null;
}

export function AdminLedgerInlineEditForm({
  action,
  className,
  children
}: {
  action: ServerAction;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onBlurCapture={(e) => {
        const form = formRef.current;
        if (!form) return;
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
        if (e.target.type === "hidden") return;
        const next = e.relatedTarget as Node | null;
        if (next && form.contains(next)) return;
        form.requestSubmit();
      }}
    >
      {children}
      <SaveStatus />
    </form>
  );
}
