"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LetterSection } from "@/app/room/[slug]/letter-section";
import type { Letter } from "@/lib/letters-shared";

const REFRESH_EVENT = "admin-notifications-refresh";

export function AdminLetterThreadModal({
  slug,
  slugKey,
  guestId,
  guestKey,
  threadTitle,
  counterpartName,
  articleHref,
  articleLinkLabel,
  closeHref
}: {
  slug: string;
  slugKey: string;
  guestId: string;
  guestKey: string;
  threadTitle: string;
  counterpartName: string;
  articleHref: string;
  articleLinkLabel: string;
  closeHref: string;
}) {
  const router = useRouter();
  const [markReadError, setMarkReadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setMarkReadError(null);
      try {
        const res = await fetch("/api/admin/letters/mark-thread-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugKey, guestKey })
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          setMarkReadError(data?.error?.message ?? "文通を既読にできませんでした。もう一度お試しください。");
          return;
        }
        window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
      } catch {
        setMarkReadError("文通を既読にできませんでした。接続を確認して、もう一度お試しください。");
      }
    })();
  }, [slugKey, guestKey]);

  const initialLetters: Letter[] = [];

  return (
    <>
      {markReadError ? (
        <p className="letter-form-error" role="alert">
          {markReadError}
        </p>
      ) : null}
      <LetterSection
        key={`${slugKey}__${guestKey}`}
        slug={slug}
        guestId={guestId}
        initialLetters={initialLetters}
        autoOpen
        hideOpenButton
        threadTitle={threadTitle}
        viewerRole="admin"
        counterpartName={counterpartName}
        placeholder={`${counterpartName}へのことば`}
        headerExtra={
          <Link href={articleHref} className="text-link admin-letter-open-article">
            {articleLinkLabel}
          </Link>
        }
        onOpenChange={(open) => {
          if (!open) router.push(closeHref);
        }}
      />
    </>
  );
}
