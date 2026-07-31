import { readFile } from "fs/promises";
import path from "path";
import { isFilesystemContentStore, isPostgresAssetStore } from "@/lib/content-store";
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
  return (
    /^[\p{L}\p{N}_.-]{1,160}\.(?:jpe?g|png|gif|webp)$/iu.test(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("\0")
  );
}

/** PostgreSQL-backed thumbnails; disk reads are development-only. */
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!isSafeFilename(filename)) {
    return new Response("Not Found", { status: 404 });
  }

  if (isPostgresAssetStore()) {
    const row = await dbGetThumbnailBlob(filename);
    if (row) {
      return new Response(new Uint8Array(row.data), {
        headers: {
          "Content-Type": row.contentType,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  if (!isFilesystemContentStore()) return new Response("Not Found", { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "thumbnails", filename));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeFromName(filename),
          "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
