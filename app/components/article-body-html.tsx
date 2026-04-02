"use client";

import { useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { LinkPreviewCard } from "@/app/components/link-preview-card";
import { isCustomLinkLabelForPreview } from "@/lib/article-link-label";
import { toPublicAbsoluteHref } from "@/lib/public-url";

const INLINE_LINK_CLASS = "article-body-link-inline";

/** ブロック内で当該リンク以外に意味のあるテキストがなければスタンドアロン（カード化対象） */
function isStandaloneLinkInBlock(anchor: HTMLAnchorElement): boolean {
  const block =
    anchor.closest(
      "p, li, td, th, blockquote, dd, h1, h2, h3, h4, h5, h6, summary, figcaption"
    ) ?? anchor.parentElement;
  if (!block || !block.contains(anchor)) return true;

  const range = document.createRange();
  range.setStart(block, 0);
  range.setEndBefore(anchor);
  const before = range.toString().replace(/\s/g, "");
  range.setStartAfter(anchor);
  range.setEnd(block, block.childNodes.length);
  const after = range.toString().replace(/\s/g, "");
  return before.length === 0 && after.length === 0;
}

function ArticleLinkLabelButton({ href, label }: { href: string; label: string }) {
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className="article-body-link-label-btn"
      {...(external ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

/**
 * 記事 HTML を描画し、単独行の http(s) およびサイト内パスの &lt;a&gt; を OG 付きリンクカードに差し替える。
 * 文中に埋め込まれたリンクはプレーンなハイパーリンクのままにする。
 */
export function ArticleBodyHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const rootEl = ref.current;
    if (!rootEl) return;

    const roots: Root[] = [];

    rootEl.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (a.classList.contains("article-tag")) return;
      if (/^mailto:/i.test(href) || /^tel:/i.test(href)) return;

      const isHttp = /^https?:\/\//i.test(href);
      const isPath = href.startsWith("/") || href.startsWith("./") || href.startsWith("../");
      if (!isHttp && !isPath) return;

      if (!isStandaloneLinkInBlock(a)) {
        a.classList.add(INLINE_LINK_CLASS);
        return;
      }

      const label = (a.textContent ?? "").trim() || undefined;
      const span = document.createElement("span");
      span.className = "article-link-preview-host";
      a.replaceWith(span);
      const root = createRoot(span);
      const useLabelBtn = label != null && isCustomLinkLabelForPreview(href, label);
      root.render(
        useLabelBtn ? (
          <ArticleLinkLabelButton href={href} label={label} />
        ) : (
          <LinkPreviewCard
            key={`${href}__${toPublicAbsoluteHref(href)}`}
            href={href}
            fallbackLabel={label}
            variant="article"
          />
        )
      );
      roots.push(root);
    });

    return () => {
      roots.forEach((r) => r.unmount());
    };
  }, [html]);

  return <div ref={ref} className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
