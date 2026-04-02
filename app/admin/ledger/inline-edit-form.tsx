"use client";

import { useRef, type ReactNode } from "react";

type ServerAction = (formData: FormData) => Promise<void>;

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
    </form>
  );
}
