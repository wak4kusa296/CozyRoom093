/**
 * Vercel 等のサーバーレスではデプロイ済みファイルシステムが読み取り専用（EROFS）のため、
 * content/*.md への直接書き込みはできない。
 * CONTENT_MARKDOWN_STORE=postgres のときは PostgreSQL に保存し、本番でも書き込み可能。
 */
const READONLY_FS_MESSAGE =
  "この環境では content フォルダへ書き込みできません（Vercel などのサーバーレスは読み取り専用です）。記事の追加・更新は CONTENT_MARKDOWN_STORE=postgres を設定するか、リポジトリの content/ を Git からデプロイするか、ディスク書き込み可能なサーバーで運用してください。";

/** 記事本文を Postgres の content_articles に保存する（マイグレーション 005 必須） */
export function isPostgresMarkdownStore(): boolean {
  return process.env.CONTENT_MARKDOWN_STORE === "postgres";
}

export function isContentMarkdownFilesystemWritable(): boolean {
  if (process.env.CONTENT_FS_READONLY === "1") return false;
  if (process.env.VERCEL) return false;
  return true;
}

/** ブラウザから MD を保存できるか（DB モード or ローカル FS） */
export function isContentMarkdownPersistable(): boolean {
  return isPostgresMarkdownStore() || isContentMarkdownFilesystemWritable();
}

export function assertContentMarkdownFilesystemWritable(): void {
  if (!isContentMarkdownFilesystemWritable()) {
    throw new Error(READONLY_FS_MESSAGE);
  }
}

export function assertContentMarkdownWritable(): void {
  if (isPostgresMarkdownStore()) return;
  assertContentMarkdownFilesystemWritable();
}
