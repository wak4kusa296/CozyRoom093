"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeIcon } from "@/app/components/home-icon";
import { MagazineBannerLink } from "@/app/components/magazine-banner-link";
import type { ContentMeta } from "@/lib/content-shared";
import { BookshelfCarousel } from "./bookshelf-carousel";

type MagazineSummary = { name: string; count: number; latestDate: string };

type MagazineMeta = { name: string; description: string; thumbnail?: string };

export function RoomSearchClient({
  items,
  magazineSummaries,
  magazinesMeta,
  magazineThumbnails,
  firstRegisteredMagazineThumbnail,
  allTags,
  initialQuery
}: {
  items: ContentMeta[];
  magazineSummaries: MagazineSummary[];
  magazinesMeta: MagazineMeta[];
  magazineThumbnails: Record<string, string>;
  firstRegisteredMagazineThumbnail?: string;
  allTags: string[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const magazineByName = useMemo(
    () => new Map(magazinesMeta.map((m) => [m.name, m])),
    [magazinesMeta]
  );

  const magazineNamesForSuggest = useMemo(() => {
    const s = new Set<string>();
    for (const m of magazinesMeta) s.add(m.name);
    for (const row of magazineSummaries) s.add(row.name);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
  }, [magazinesMeta, magazineSummaries]);

  const normalizedQ = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    const t = normalizedQ;
    if (!t) return items;
    return items.filter((item) => {
      if (item.title.toLowerCase().includes(t)) return true;
      if (item.slug.toLowerCase().includes(t)) return true;
      if (item.tags.some((x) => x.toLowerCase().includes(t))) return true;
      if (item.magazines.some((x) => x.toLowerCase().includes(t))) return true;
      const body = item.searchText?.toLowerCase() ?? "";
      if (body.includes(t)) return true;
      return false;
    });
  }, [items, normalizedQ]);

  const filteredMagazineSummaries = useMemo(() => {
    const t = normalizedQ;
    if (!t) return magazineSummaries;
    return magazineSummaries.filter((summary) => {
      if (summary.name.toLowerCase().includes(t)) return true;
      const meta = magazineByName.get(summary.name);
      const desc = meta?.description?.trim().toLowerCase() ?? "";
      return desc.includes(t);
    });
  }, [magazineSummaries, magazineByName, normalizedQ]);

  const tagSuggestions = useMemo(() => {
    if (!normalizedQ) return [];
    return allTags.filter((tag) => tag.toLowerCase().includes(normalizedQ)).slice(0, 8);
  }, [allTags, normalizedQ]);

  const magazineSuggestions = useMemo(() => {
    if (!normalizedQ) return [];
    return magazineNamesForSuggest.filter((name) => name.toLowerCase().includes(normalizedQ)).slice(0, 8);
  }, [magazineNamesForSuggest, normalizedQ]);

  const hasSuggestions = tagSuggestions.length > 0 || magazineSuggestions.length > 0;

  const clearBlurTimer = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearBlurTimer();
  }, [clearBlurTimer]);

  return (
    <main className="room">
      <section className="room-search-hero" aria-label="記事・マガジンを検索">
        <p className="meta room-search-back-meta">
          <Link href="/room" className="room-top-page-link">
            <HomeIcon />
            トップページへ戻る
          </Link>
        </p>
        <div className="room-search-minimal">
          <label htmlFor="room-search-input" className="room-search-label">
            検索
          </label>
          <div className="room-search-input-wrap">
            <span className="material-symbols-outlined room-search-input-icon" aria-hidden="true">
              search
            </span>
            <input
              ref={inputRef}
              id="room-search-input"
              type="search"
              name="q"
              value={query}
              autoComplete="off"
              placeholder="タイトル・本文・タグ・マガジン名…"
              className="room-search-input"
              aria-autocomplete="list"
              aria-controls="room-search-suggestions"
              aria-expanded={suggestOpen && hasSuggestions}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => {
                clearBlurTimer();
                setSuggestOpen(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setSuggestOpen(false), 150);
              }}
            />
          </div>
          {suggestOpen && hasSuggestions ? (
            <div
              id="room-search-suggestions"
              className="room-search-suggestions"
              role="listbox"
              aria-label="検索候補"
            >
              {tagSuggestions.length > 0 ? (
                <p className="room-search-suggest-heading">タグ</p>
              ) : null}
              <ul className="room-search-suggest-list">
                {tagSuggestions.map((tag) => (
                  <li key={`tag:${tag}`} role="option">
                    <button
                      type="button"
                      className="room-search-suggest-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(tag);
                        setSuggestOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="room-search-suggest-kind">タグ</span>
                      <span>{tag}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {magazineSuggestions.length > 0 ? (
                <p className="room-search-suggest-heading">マガジン</p>
              ) : null}
              <ul className="room-search-suggest-list">
                {magazineSuggestions.map((name) => (
                  <li key={`mag:${name}`} role="option">
                    <button
                      type="button"
                      className="room-search-suggest-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(name);
                        setSuggestOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="room-search-suggest-kind">マガジン</span>
                      <span>{name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section id="magazines">
        <h2 className="section-title">マガジン一覧</h2>
        {magazineSummaries.length === 0 ? (
          <p className="bookshelf-empty">まだ登録されたマガジンはありません。</p>
        ) : filteredMagazineSummaries.length === 0 ? (
          <p className="bookshelf-empty">該当するマガジンはありません。</p>
        ) : (
          <div className="article-magazine-banners" aria-label="マガジン一覧">
            {filteredMagazineSummaries.map((magazine) => {
              const meta = magazineByName.get(magazine.name);
              const parts = [meta?.description?.trim(), `${magazine.count}件`].filter(Boolean).join(" · ");
              return (
                <MagazineBannerLink
                  key={magazine.name}
                  magazineName={magazine.name}
                  description={parts}
                  thumbnail={meta?.thumbnail}
                />
              );
            })}
          </div>
        )}
      </section>

      <section id="works">
        <h2 className="section-title">記事一覧</h2>
        {items.length === 0 ? (
          <p className="bookshelf-empty">まだ本棚に並ぶ頁はありません。</p>
        ) : filteredItems.length === 0 ? (
          <p className="bookshelf-empty">該当する記事は見つかりません。</p>
        ) : (
          <BookshelfCarousel
            variant="magazine"
            magazineLayout="search-grid"
            items={filteredItems}
            magazineThumbnails={magazineThumbnails}
            firstRegisteredMagazineThumbnail={firstRegisteredMagazineThumbnail}
            emptyFilterMessage="該当する記事は見つかりません。"
          />
        )}
      </section>
    </main>
  );
}
