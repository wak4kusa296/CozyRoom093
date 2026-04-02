import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPostgresMarkdownStore } from "@/lib/content-fs-env";
import { dbDeleteThumbnailBlob, dbUpsertThumbnailBlob } from "@/lib/thumbnail-blobs-db";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const THUMBNAILS_DIR = path.join(process.cwd(), "public", "thumbnails");
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024;

function toSafeExtension(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
  };
  return map[mimeType] ?? "jpg";
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

  const ext = toSafeExtension(file.type);
  const filename = `${prefix}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isPostgresMarkdownStore()) {
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
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  try {
    if (isPostgresMarkdownStore()) {
      await dbDeleteThumbnailBlob(filename);
    }
    await unlink(path.join(THUMBNAILS_DIR, filename)).catch(() => undefined);
  } catch {
    // File may already be removed
  }

  return NextResponse.json({ ok: true });
}
