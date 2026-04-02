"use client";

import type { ReactNode } from "react";

import { LinkPreviewCard } from "@/app/components/link-preview-card";
import { toPublicAbsoluteHref } from "@/lib/public-url";

/**
 * ルーム通知モーダル用。記事と同じ OG リンクカード（タイトル・説明・カバー）。
 */
export function ArticleStylePushLink({
  href,
  children,
  preview = false
}: {
  href: string;
  children: ReactNode;
  /** 管理画面プレビューなど、クリックで遷移させないとき true */
  preview?: boolean;
}) {
  const fallbackLabel =
    typeof children === "string" || typeof children === "number" ? String(children) : undefined;

  return (
    <div className="room-notification-push-dialog-link-wrap">
      <LinkPreviewCard
        key={`${href}__${toPublicAbsoluteHref(href)}`}
        href={href}
        fallbackLabel={fallbackLabel}
        preview={preview}
        variant="modal"
      />
    </div>
  );
}
