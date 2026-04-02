import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  excerptFromArticleHtml,
  getContentBySlug,
  normalizeSlugParam,
  resolveContentThumbnail
} from "@/lib/content";
import { getFirstRegisteredMagazineThumbnail, listMagazines } from "@/lib/magazines";
import { markGuestNotificationRead } from "@/lib/guest-notification-reads";
import { getLetters } from "@/lib/letters";
import { pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { isPrivateArticleAccessAllowedByReferer } from "@/lib/private-article-referer";
import { formatSiteDateTime } from "@/lib/site-datetime";
import { ArticleBodyHtml } from "@/app/components/article-body-html";
import { HeartButton } from "@/app/components/heart-button";
import { MagazineBannerLink } from "@/app/components/magazine-banner-link";
import { HomeIcon } from "@/app/components/home-icon";
import { LetterSection } from "./letter-section";

function siteMetadataBase() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return new URL(`${base}/`);
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const normalizedSlug = normalizeSlugParam(slug);
  let item: Awaited<ReturnType<typeof getContentBySlug>>;
  try {
    item = await getContentBySlug(normalizedSlug);
  } catch {
    return { title: "誰も知らない部屋" };
  }

  const metadataBase = siteMetadataBase();

  if (item.status !== "public") {
    return {
      metadataBase,
      title: "誰も知らない部屋",
      robots: { index: false, follow: false }
    };
  }

  const [magazines, firstRegThumb] = await Promise.all([
    listMagazines(),
    getFirstRegisteredMagazineThumbnail()
  ]);
  const magazineThumbnails: Record<string, string> = {};
  for (const m of magazines) {
    if (m.thumbnail) magazineThumbnails[m.name] = m.thumbnail;
  }
  const thumb = resolveContentThumbnail(item, magazineThumbnails, firstRegThumb);
  const description = excerptFromArticleHtml(item.html, 160) || undefined;
  const ogImagePath = thumb ? `/thumbnails/${thumb}` : undefined;

  return {
    metadataBase,
    title: item.title,
    description,
    openGraph: {
      title: item.title,
      description,
      type: "article",
      ...(ogImagePath ? { images: [{ url: ogImagePath }] } : {})
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      ...(ogImagePath ? { images: [ogImagePath] } : {})
    }
  };
}

export default async function ContentPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guest?: string | string[]; letters?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const resolvedSearchParams = await searchParams;
  const guestFromQuery = Array.isArray(resolvedSearchParams.guest)
    ? resolvedSearchParams.guest[0] ?? ""
    : resolvedSearchParams.guest ?? "";
  const lettersFromQuery = Array.isArray(resolvedSearchParams.letters)
    ? resolvedSearchParams.letters[0] ?? ""
    : resolvedSearchParams.letters ?? "";
  const { slug } = await params;
  const normalizedSlug = normalizeSlugParam(slug);
  const item = await getContentBySlug(normalizedSlug).catch(() => notFound());
  if (item.status !== "public" && session.role !== "admin") {
    notFound();
  }

  if (item.status !== "public" && session.role === "admin") {
    const referer = (await headers()).get("referer");
    if (!isPrivateArticleAccessAllowedByReferer(referer, normalizedSlug)) {
      notFound();
    }
  }

  if (item.status === "public") {
    await markGuestNotificationRead(session.guestId, `content|${normalizedSlug}`);
    pingRoomNotificationSubscriber(session.guestId);
  }

  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const shouldOpenLetters = lettersFromQuery === "open";
  const markThreadReadOnOpen =
    session.role === "guest" || (session.role === "admin" && !guestFromQuery);
  const letters = await getLetters(normalizedSlug, targetGuestId);
  const magazines = await listMagazines();
  const magazineByName = new Map(magazines.map((m) => [m.name, m]));

  return (
    <main className="article-wrap">
      <article className="article-card">
        <div className="article-main-block">
          <div className="article-sticky-header">
            <div className="article-sticky-subtitle-block">
              <nav className="article-breadcrumb section-title section-title-sub" aria-label="パンくず">
                <Link href="/room" className="room-top-page-link">
                  <HomeIcon />
                  トップページ
                </Link>
                <span aria-hidden="true">/</span>
                <span>受信した手記</span>
              </nav>
            </div>
            <div className="article-sticky-title-block">
              <p className="meta">{formatSiteDateTime(item.date)}</p>
              <h1>{item.title}</h1>
            </div>
          </div>
          <ArticleBodyHtml html={item.html} />
          <HeartButton slug={normalizedSlug} />
        </div>
      </article>

      <div id="letters" className="letter-block">
        <LetterSection
          slug={normalizedSlug}
          initialLetters={letters}
          guestId={targetGuestId}
          autoOpen={shouldOpenLetters}
          markThreadReadOnOpen={markThreadReadOnOpen}
        />
      </div>

      {item.magazines.length > 0 ? (
        <div className="article-magazine-banners" aria-label="所属マガジン">
          {item.magazines.map((magazineName) => {
            const mag = magazineByName.get(magazineName);
            return (
              <MagazineBannerLink
                key={`${item.slug}-${magazineName}`}
                magazineName={magazineName}
                description={mag?.description}
                thumbnail={mag?.thumbnail}
              />
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
