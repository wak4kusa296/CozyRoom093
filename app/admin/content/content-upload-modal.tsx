"use client";

import { useEffect, useId, useState } from "react";

export function ContentUploadModal({
  action
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="admin-upload-open-button" onClick={() => setOpen(true)}>
        記事をアップロード
      </button>
      {open ? (
        <div className="admin-magazine-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="admin-upload-modal"
            role="dialog"
            aria-modal="true"
            aria-label="記事アップロード"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>記事アップロード</h2>
              <button type="button" className="ghost letter-close-button" onClick={() => setOpen(false)} aria-label="閉じる">
                close
              </button>
            </div>
            <p className="meta">Markdown（.md）ファイルを1つ選択してください。</p>
            <form action={action} className="stack">
              <label htmlFor={fileInputId} className="admin-upload-file-picker">
                <span className="admin-upload-file-picker-title">MDファイルを選択</span>
                <span className="admin-upload-file-picker-sub">
                  {fileName || "クリックしてファイルを選ぶ"}
                </span>
                <input
                  id={fileInputId}
                  name="contentFile"
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  required
                  className="admin-upload-file-input"
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
                />
              </label>
              <button type="submit" className="admin-add-button">
                アップロードする
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
