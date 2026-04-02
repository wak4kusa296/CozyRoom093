import { readFile } from "fs/promises";
import path from "path";
import { isPostgresMarkdownStore } from "@/lib/content-fs-env";
import { dbGetThumbnailBlob } from "@/lib/thumbnail-blobs-db";

export const runtime = "nodejs";

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function isSafeFilename(filename: string): boolean {
  if (!filename || filename.length > 512) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  return true;
}

/** Git 同梱の public/thumbnails が無い場合（DB のみ）はここから配信 */
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!isSafeFilename(filename)) {
    return new Response("Not Found", { status: 404 });
  }

  if (isPostgresMarkdownStore()) {
    const row = await dbGetThumbnailBlob(filename);
    if (row) {
      return new Response(new Uint8Array(row.data), {
        headers: {
          "Content-Type": row.contentType,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
  }

  try {
    const buf = await readFile(path.join(process.cwd(), "public", "thumbnails", filename));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeFromName(filename),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
