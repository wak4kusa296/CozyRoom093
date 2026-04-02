/**
 * クライアントでも import 可能な型・純粋関数（Node の fs / lib/db に依存しない）。
 * lib/content.ts はサーバー専用のため、本棚コンポーネント等はここから参照する。
 */

export type ContentType = "article" | "illustration" | "video";

export type ContentMeta = {
  slug: string;
  title: string;
  date: string;
  published_at?: string;
  updated_at?: string;
  status: "private" | "public";
  type: ContentType;
  magazines: string[];
  tags: string[];
  thumbnail?: string;
  /** マークダウン本文から生成したプレーン文字列（検索用） */
  searchText?: string;
};

export type ContentDetail = ContentMeta & {
  html: string;
};

/**
 * 本棚・OGP 用サムネイルファイル名。
 * 1) 記事の thumbnail
 * 2) 所属マガジンを frontmatter 順に見て最初にサムネがあるもの
 * 3) 登録順で最初のマガジンサムネ（全体フォールバック）
 */
export function resolveContentThumbnail(
  item: ContentMeta,
  magazineThumbnails: Record<string, string>,
  firstRegisteredMagazineThumbnail?: string
): string | undefined {
  if (item.thumbnail) return item.thumbnail;
  for (const name of item.magazines) {
    const t = magazineThumbnails[name];
    if (t) return t;
  }
  return firstRegisteredMagazineThumbnail;
}
