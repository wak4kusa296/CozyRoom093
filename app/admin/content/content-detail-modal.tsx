"use client";

import { readAdminJson } from "@/lib/admin-read-json";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useEffect, useId, useRef, useState } from "react";
import { MagazineMultiToggle } from "@/app/admin/content/magazine-multi-toggle";

type ContentItem = {
  slug: string;
  title: string;
  status: "public" | "private";
  magazines: string[];
  thumbnail?: string;
};

type DetailModalProps = {
  item: ContentItem;
  allMagazineOptions: string[];
  mdFileName: string;
  publishedDisplay: string;
  updatedDisplay: string;
  issuedUrl: string;
  heartTotal: number;
  letterGuestCount: number;
  lettersUrl: string;
  isPublic: boolean;
  toggleContentStatusAction: (formData: FormData) => void | Promise<void>;
  updateContentMagazinesAction: (formData: FormData) => void | Promise<void>;
  replaceContentFileAction: (formData: FormData) => void | Promise<void>;
  deleteContentAction: (formData: FormData) => void | Promise<void>;
  updateContentThumbnailAction: (formData: FormData) => void | Promise<void>;
  updateContentTitleAction: (formData: FormData) => void | Promise<void>;
};

export function ContentDetailModal({
  item,
  allMagazineOptions,
  mdFileName,
  publishedDisplay,
  updatedDisplay,
  issuedUrl,
  heartTotal,
  letterGuestCount,
  lettersUrl,
  isPublic,
  toggleContentStatusAction,
  updateContentMagazinesAction,
  replaceContentFileAction,
  deleteContentAction,
  updateContentThumbnailAction,
  updateContentTitleAction
}: DetailModalProps) {
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useFocusTrap(dialogRef, open, closeModal);
  const [replaceFileName, setReplaceFileName] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const replaceFileInputId = useId();
  const titleInputId = useId();
  const thumbFileInputId = useId();
  const titleFormRef = useRef<HTMLFormElement>(null);

  function closeModal() {
    setOpen(false);
    setReplaceOpen(false);
    setReplaceFileName("");
    setThumbError(null);
  }

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
      <div
        className="admin-content-row-button"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`${item.title}の詳細を開く`}
      >
        <span className="admin-content-row-title">{item.title}</span>
        <span className="admin-content-row-metrics" aria-label="文通中人数といいね数">
          <span className="admin-content-row-metric">
            <span className="material-symbols-outlined" aria-hidden="true">
              group
            </span>
            <span>{letterGuestCount}</span>
          </span>
          <span className="admin-content-row-metric">
            <span className="material-symbols-outlined" aria-hidden="true">
              favorite
            </span>
            <span>{heartTotal}</span>
          </span>
        </span>
        <form
          action={toggleContentStatusAction}
          className="admin-content-status-form"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input type="hidden" name="slug" value={item.slug} />
          <input type="hidden" name="nextStatus" value={isPublic ? "private" : "public"} />
          <button
            type="submit"
            className={isPublic ? "admin-content-visibility-toggle is-public" : "admin-content-visibility-toggle"}
            aria-label={isPublic ? "公開中。クリックで非公開に切り替え" : "非公開中。クリックで公開に切り替え"}
          >
            <span className="material-symbols-outlined admin-content-visibility-icon" aria-hidden="true">
              {isPublic ? "visibility" : "visibility_off"}
            </span>
          </button>
        </form>
      </div>

      {open ? (
        <div className="admin-magazine-modal-backdrop" onClick={closeModal}>
          <section
            ref={dialogRef}
            className="admin-magazine-settings-modal admin-content-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="記事詳細"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <form
                ref={titleFormRef}
                action={updateContentTitleAction}
                className="admin-content-title-form"
                onBlurCapture={(event) => {
                  const form = titleFormRef.current;
                  if (!form) return;
                  if (!(event.target instanceof HTMLInputElement)) return;
                  if (event.target.name !== "title") return;
                  const next = event.relatedTarget as Node | null;
                  if (next && form.contains(next)) return;
                  form.requestSubmit();
                }}
              >
                <input type="hidden" name="slug" value={item.slug} />
                <label htmlFor={titleInputId} className="sr-only">
                  記事タイトル
                </label>
                <input
                  id={titleInputId}
                  name="title"
                  type="text"
                  defaultValue={item.title}
                  required
                  className="admin-content-title-input"
                  lang="ja"
                  autoComplete="off"
                />
              </form>
              <button type="button" className="ghost letter-close-button" onClick={closeModal} aria-label="閉じる">
                close
              </button>
            </div>

            <section className="admin-content-detail-section admin-thumb-section">
              <div className="admin-thumb-preview admin-thumb-preview-wrap" aria-busy={thumbUploading}>
                <div className="admin-thumb-preview-fill">
                  {item.thumbnail ? (
                    <img src={`/thumbnails/${item.thumbnail}`} alt="" />
                  ) : (
                    <span className="meta">サムネイルなし</span>
                  )}
                </div>
                <div className="admin-thumb-overlay" role="group" aria-label="サムネイルの操作">
                  <label htmlFor={thumbFileInputId} className="admin-thumb-overlay-btn">
                    {thumbUploading ? "…" : item.thumbnail ? "変更" : "追加"}
                  </label>
                  {item.thumbnail ? (
                    <button
                      type="button"
                      className="admin-thumb-overlay-btn"
                      disabled={thumbUploading}
                      onClick={async () => {
                        if (!item.thumbnail) return;
                        setThumbError(null);
                        setThumbUploading(true);
                        try {
                          const del = await fetch("/api/admin/thumbnails", {
                            method: "DELETE",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filename: item.thumbnail })
                          });
                          if (!del.ok) {
                            setThumbError(
                              del.status === 401
                                ? "管理者のセッションが切れています。"
                                : "サムネイルの削除に失敗しました。"
                            );
                            return;
                          }
                          const actionFd = new FormData();
                          actionFd.set("slug", item.slug);
                          actionFd.set("thumbnail", "");
                          await updateContentThumbnailAction(actionFd);
                        } catch (e) {
                          setThumbError(e instanceof Error ? e.message : "サムネイルの削除に失敗しました。");
                        } finally {
                          setThumbUploading(false);
                        }
                      }}
                    >
                      削除
                    </button>
                  ) : null}
                </div>
                <input
                  id={thumbFileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="admin-upload-file-input"
                  disabled={thumbUploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setThumbError(null);
                    setThumbUploading(true);
                    try {
                      if (item.thumbnail) {
                        await fetch("/api/admin/thumbnails", {
                          method: "DELETE",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ filename: item.thumbnail })
                        });
                      }
                      const fd = new FormData();
                      fd.set("file", file);
                      fd.set("prefix", `content-${item.slug}`);
                      const res = await fetch("/api/admin/thumbnails", {
                        method: "POST",
                        credentials: "include",
                        body: fd
                      });
                      const json = await readAdminJson<{ filename?: string; error?: string }>(res);
                      if (!res.ok || !json.filename) {
                        setThumbError(
                          res.status === 401
                            ? "管理者のセッションが切れています。ページを再読み込みしてください。"
                            : json.error === "file too large"
                              ? "画像は5MB以下にしてください。"
                              : json.error === "write_failed"
                                ? "サーバーに保存できませんでした。本番ではホストの書き込み制限があることがあります。"
                                : "サムネイルのアップロードに失敗しました。"
                        );
                        return;
                      }
                      const actionFd = new FormData();
                      actionFd.set("slug", item.slug);
                      actionFd.set("thumbnail", json.filename);
                      await updateContentThumbnailAction(actionFd);
                    } catch (e) {
                      setThumbError(e instanceof Error ? e.message : "サムネイルのアップロードに失敗しました。");
                    } finally {
                      setThumbUploading(false);
                      event.target.value = "";
                    }
                  }}
                />
              </div>
              {thumbError ? (
                <p className="message" role="alert">
                  {thumbError}
                </p>
              ) : null}
            </section>

            <dl className="admin-content-detail-grid">
              <div
                className="admin-content-meta-line admin-content-meta-toggle"
                role="button"
                tabIndex={0}
                aria-expanded={replaceOpen}
                onClick={() => setReplaceOpen((v) => !v)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setReplaceOpen((v) => !v);
                  }
                }}
              >
                <dt>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    description
                  </span>
                  <span>md</span>
                </dt>
                <dd>{mdFileName}</dd>
              </div>
              {replaceOpen ? (
                <div className="admin-content-meta-inline-form">
                  <dt aria-hidden="true" />
                  <dd>
                    <form action={replaceContentFileAction} className="admin-content-replace-form">
                      <input type="hidden" name="slug" value={item.slug} />
                      <label htmlFor={replaceFileInputId} className="admin-upload-file-picker">
                        <span className="admin-upload-file-picker-title">MDファイルを選択</span>
                        <span className="admin-upload-file-picker-sub">
                          {replaceFileName || "クリックしてファイルを選ぶ"}
                        </span>
                        <input
                          id={replaceFileInputId}
                          name="contentFile"
                          type="file"
                          accept=".md,text/markdown,text/plain"
                          required
                          className="admin-upload-file-input"
                          onChange={(event) => setReplaceFileName(event.target.files?.[0]?.name ?? "")}
                        />
                      </label>
                      <button type="submit" className="admin-add-button">
                        保存
                      </button>
                    </form>
                  </dd>
                </div>
              ) : null}
              <div className="admin-content-meta-line">
                <dt>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    calendar_today
                  </span>
                  <span>公開</span>
                </dt>
                <dd>{publishedDisplay}</dd>
              </div>
              <div className="admin-content-meta-line">
                <dt>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    update
                  </span>
                  <span>更新</span>
                </dt>
                <dd>{updatedDisplay}</dd>
              </div>
              <div className="admin-content-meta-line">
                <dt>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    link
                  </span>
                  <span>URL</span>
                </dt>
                <dd>
                  <a href={issuedUrl} target="_blank" rel="noreferrer" className="admin-content-issued-url">
                    {issuedUrl}
                  </a>
                </dd>
              </div>
              <div className="admin-content-meta-line">
                <dt>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    favorite
                  </span>
                  <span>反応</span>
                </dt>
                <dd className="admin-meta-actions">
                  <span className="admin-heart-count">
                    <span className="material-symbols-outlined admin-heart-icon" aria-hidden="true">
                      favorite
                    </span>
                    <span>{heartTotal}</span>
                  </span>
                  <a href={lettersUrl} className="admin-meta-icon-link" aria-label="この記事の文通一覧へ">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      forum
                    </span>
                    <span className="admin-meta-icon-count">{letterGuestCount}</span>
                  </a>
                </dd>
              </div>
            </dl>

            <section className="admin-content-detail-section">
              <form action={updateContentMagazinesAction} className="admin-content-magazine-inline-form">
                <input type="hidden" name="slug" value={item.slug} />
                <span className="admin-content-magazine-inline-label">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    collections_bookmark
                  </span>
                  <span>マガジン</span>
                </span>
                <MagazineMultiToggle options={allMagazineOptions} initialSelected={item.magazines} />
              </form>
            </section>

            <section className="admin-content-detail-section">
              <form action={deleteContentAction} className="admin-content-delete-form">
                <input type="hidden" name="slug" value={item.slug} />
                <button type="submit" className="admin-icon-ghost" aria-label={`${item.title}を削除`}>
                  <span className="material-symbols-outlined admin-delete-icon" aria-hidden="true">
                    delete
                  </span>
                </button>
              </form>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
}
