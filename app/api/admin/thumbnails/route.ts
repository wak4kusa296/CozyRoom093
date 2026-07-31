import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPostgresAssetStore } from "@/lib/content-store";
import { dbDeleteThumbnailBlob, dbUpsertThumbnailBlob } from "@/lib/thumbnail-blobs-db";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const THUMBNAILS_DIR = path.join(process.cwd(), "public", "thumbnails");
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024;
const SAFE_PREFIX = /^[\p{L}\p{N}_-]{1,80}$/u;
const SAFE_FILENAME = /^[\p{L}\p{N}_.-]{1,160}\.(?:jpe?g|png|gif|webp)$/iu;

function toSafeExtension(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
  };
  return map[mimeType] ?? "jpg";
}

function isSafeFilename(filename: string): boolean {
  return (
    SAFE_FILENAME.test(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("\0")
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const prefix = String(formData.get("prefix") ?? "thumb");

  if (!file || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }
  if (!SAFE_PREFIX.test(prefix)) {
    return NextResponse.json({ error: "invalid prefix" }, { status: 400 });
  }

  const ext = toSafeExtension(file.type);
  const filename = `${prefix}-${Date.now()}.${ext}`;
  if (!isSafeFilename(filename)) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isPostgresAssetStore()) {
      await dbUpsertThumbnailBlob(filename, buffer, file.type);
    } else {
      await mkdir(THUMBNAILS_DIR, { recursive: true });
      await writeFile(path.join(THUMBNAILS_DIR, filename), buffer);
    }
  } catch (err) {
    console.error("[thumbnails POST] write failed", err);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  return NextResponse.json({ filename });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = (await request.json()) as { filename?: string };
  if (!filename || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  try {
    if (isPostgresAssetStore()) {
      await dbDeleteThumbnailBlob(filename);
    } else {
      await unlink(path.join(THUMBNAILS_DIR, filename)).catch(() => undefined);
    }
  } catch {
    // File may already be removed
  }

  return NextResponse.json({ ok: true });
}
