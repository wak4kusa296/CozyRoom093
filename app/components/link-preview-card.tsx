"use client";

import { useEffect, useMemo, useState } from "react";
import type { LinkPreviewData } from "@/lib/link-preview";
import { toPublicAbsoluteHref } from "@/lib/public-url";

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; data: LinkPreviewData }
  | { kind: "err" };

export function LinkPreviewCard({
  href,
  fallbackLabel,
  preview = false,
  variant = "article"
}: {
  href: string;
  /** OG 取得失敗時やロード前のテキスト */
  fallbackLabel?: string;
  preview?: boolean;
  variant?: "article" | "modal";
}) {
  const absUrl = useMemo(() => toPublicAbsoluteHref(href), [href]);
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/link-preview?url=${encodeURIComponent(absUrl)}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          preview?: LinkPreviewData;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.preview) {
          setState({ kind: "err" });
          return;
        }
        setState({ kind: "ok", data: json.preview });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "err" });
      });

    return () => {
      cancelled = true;
    };
  }, [absUrl]);

  const external = isExternalHref(href);
  const label = fallbackLabel?.trim() || "開く";
  const mod = variant === "modal" ? " link-preview-card--modal" : " link-preview-card--article";

  if (state.kind === "loading") {
    return (
      <div className={`link-preview-card link-preview-card--skeleton${mod}`} aria-busy="true">
        <div className="link-preview-card-skel-cover" aria-hidden="true" />
        <div className="link-preview-card-skel-lines" aria-hidden="true" />
      </div>
    );
  }

  if (state.kind === "err") {
    return (
      <a
        href={href}
        className={`link-preview-card-fallback${mod}`}
        onClick={preview ? (e) => e.preventDefault() : undefined}
        {...(external && !preview ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    );
  }

  const { data } = state;
  const showDesc = data.description.trim().length > 0;

  let siteLine = data.siteName ?? "";
  if (!siteLine) {
    try {
      siteLine = new URL(absUrl).hostname;
    } catch {
      siteLine = "";
    }
  }

  return (
    <a
      href={href}
      className={`link-preview-card${mod}`}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      {...(external && !preview ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
    >
      {data.image ? (
        <img
          src={data.image}
          alt=""
          className="link-preview-card-cover-img"
          loading="lazy"
        />
      ) : null}
      <div className="link-preview-card-body">
        <span className="link-preview-card-title">{data.title}</span>
        {showDesc ? <span className="link-preview-card-desc">{data.description}</span> : null}
        {siteLine ? <span className="link-preview-card-site">{siteLine}</span> : null}
      </div>
    </a>
  );
}
