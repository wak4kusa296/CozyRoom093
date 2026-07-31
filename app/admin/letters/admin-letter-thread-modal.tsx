"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    void fetch("/api/admin/letters/mark-thread-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugKey, guestKey })
    }).then((res) => {
      if (res.ok) window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    });
  }, [slugKey, guestKey]);

  const initialLetters: Letter[] = [];

  return (
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
  );
}
