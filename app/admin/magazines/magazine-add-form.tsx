"use client";

import { readAdminJson } from "@/lib/admin-read-json";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";

type AddResult = { ok: true; id: string } | { ok: false };

type MagazineAddFormProps = {
  addMagazineAction: (formData: FormData) => Promise<AddResult>;
  updateMagazineThumbnailAction: (formData: FormData) => void | Promise<void>;
};

export function MagazineAddForm({ addMagazineAction, updateMagazineThumbnailAction }: MagazineAddFormProps) {
  const router = useRouter();
  const thumbFileInputId = useId();
  const thumbFileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [thumbUploading, setThumbUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [thumbPreviewUrl]);

  function handleThumbFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setThumbPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (!file) return null;
      return URL.createObjectURL(file);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const description = String(new FormData(form).get("description") ?? "");
    const fileInput = thumbFileInputRef.current;
    const file = fileInput?.files?.[0] ?? null;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("description", description);
      const result = await addMagazineAction(fd);
      if (!result.ok) {
        setError("追加できませんでした（名前の重複など）。");
        return;
      }

      if (file) {
        setThumbUploading(true);
        try {
          const uploadFd = new FormData();
          uploadFd.set("file", file);
          uploadFd.set("prefix", `mag-${result.id}`);
          const res = await fetch("/api/admin/thumbnails", {
            method: "POST",
            credentials: "include",
            body: uploadFd
          });
          const json = await readAdminJson<{ filename?: string; error?: string }>(res);
          if (!res.ok || !json.filename) {
            setError(
              res.status === 401
                ? "管理者のセッションが切れています。ページを再読み込みしてください。"
                : json.error === "file too large"
                  ? "サムネイルは5MB以下にしてください。"
                  : json.error === "write_failed"
                    ? "サーバーに保存できませんでした。本番ホストでは書き込み不可のことがあります。"
                    : "サムネイルのアップロードに失敗しました。"
            );
          } else {
            const actionFd = new FormData();
            actionFd.set("id", result.id);
            actionFd.set("thumbnail", json.filename);
            await updateMagazineThumbnailAction(actionFd);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "サムネイルのアップロードに失敗しました。");
        } finally {
          setThumbUploading(false);
          if (fileInput) fileInput.value = "";
        }
      }

      form.reset();
      setThumbPreviewUrl(null);
      router.refresh();
    });
  }

  const busy = pending || thumbUploading;

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <label>
        マガジン名
        <input name="name" required disabled={busy} />
      </label>
      <label>
        説明
        <input name="description" disabled={busy} />
      </label>
      <section className="admin-content-detail-section admin-thumb-section admin-magazine-add-thumb">
        <div className="admin-thumb-preview admin-thumb-preview-add admin-thumb-preview-wrap" aria-busy={busy}>
          <div className="admin-thumb-preview-fill">
            {thumbPreviewUrl ? (
              <img src={thumbPreviewUrl} alt="" className="admin-magazine-add-thumb-preview-img" />
            ) : (
              <span className="meta">サムネイル（任意）</span>
            )}
          </div>
          <div className="admin-thumb-overlay" role="group" aria-label="サムネイル（任意）">
            <label htmlFor={thumbFileInputId} className="admin-thumb-overlay-btn">
              {busy ? "…" : thumbPreviewUrl ? "変更" : "追加"}
            </label>
            {thumbPreviewUrl ? (
              <button
                type="button"
                className="admin-thumb-overlay-btn"
                disabled={busy}
                onClick={() => {
                  setThumbPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  if (thumbFileInputRef.current) thumbFileInputRef.current.value = "";
                }}
              >
                削除
              </button>
            ) : null}
          </div>
          <input
            ref={thumbFileInputRef}
            id={thumbFileInputId}
            type="file"
            name="thumbnailFile"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="admin-upload-file-input"
            disabled={busy}
            onChange={handleThumbFileChange}
          />
        </div>
      </section>
      {error ? <p className="meta">{error}</p> : null}
      <button type="submit" className="admin-add-button" disabled={busy}>
        {busy ? "処理中…" : "追加する"}
      </button>
    </form>
  );
}
