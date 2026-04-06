"use client";

import { readAdminJson } from "@/lib/admin-read-json";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

type MagazineItem = {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
};

type MagazineCardListProps = {
  magazines: MagazineItem[];
  usageEntries: Array<[string, number]>;
  contentsByMagazine: Array<{ magazineName: string; items: Array<{ slug: string; title: string }> }>;
  updateMagazineAction: (formData: FormData) => void | Promise<void>;
  deleteMagazineAction: (formData: FormData) => void | Promise<void>;
  updateMagazineContentOrderAction: (formData: FormData) => void | Promise<void>;
  removeContentFromMagazineAction: (formData: FormData) => void | Promise<void>;
  updateMagazineThumbnailAction: (formData: FormData) => void | Promise<void>;
};

export function MagazineCardList({
  magazines,
  usageEntries,
  contentsByMagazine,
  updateMagazineAction,
  deleteMagazineAction,
  updateMagazineContentOrderAction,
  removeContentFromMagazineAction,
  updateMagazineThumbnailAction
}: MagazineCardListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managedItems, setManagedItems] = useState<Array<{ slug: string; title: string }>>([]);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [usageDeltaMap, setUsageDeltaMap] = useState(new Map<string, number>());
  const orderFormRef = useRef<HTMLFormElement | null>(null);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const managerDialogRef = useRef<HTMLElement>(null);
  const itemElementMapRef = useRef(new Map<string, HTMLLIElement>());
  const previousTopBySlugRef = useRef(new Map<string, number>());
  const activePointerIdRef = useRef<number | null>(null);
  const draggingSlugRef = useRef<string | null>(null);
  const managedItemsRef = useRef<Array<{ slug: string; title: string }>>([]);
  const hasDragOrderChangedRef = useRef(false);
  const lastSavedOrderKeyRef = useRef("");
  const usageMap = useMemo(() => new Map(usageEntries), [usageEntries]);
  const contentMap = useMemo(
    () => new Map(contentsByMagazine.map((entry) => [entry.magazineName, entry.items])),
    [contentsByMagazine]
  );

  const magazineThumbFileInputId = useId();

  const activeMagazine = useMemo(
    () => magazines.find((magazine) => magazine.id === activeId) ?? null,
    [magazines, activeId]
  );

  useFocusTrap(settingsDialogRef, !!activeMagazine, closeMagazineModal);
  useFocusTrap(managerDialogRef, !!(activeMagazine && managerOpen), closeManagerModal);

  useEffect(() => {
    if (!activeId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeId]);

  function closeMagazineModal() {
    setManagerOpen(false);
    setActiveId(null);
    setUsageDeltaMap(new Map());
    setThumbError(null);
  }

  function toOrderKey(items: Array<{ slug: string; title: string }>) {
    return items.map((item) => item.slug).join("\n");
  }

  function openManagerModal() {
    if (!activeMagazine) return;
    const initialItems = [...(contentMap.get(activeMagazine.name) ?? [])];
    setManagedItems(initialItems);
    lastSavedOrderKeyRef.current = toOrderKey(initialItems);
    hasDragOrderChangedRef.current = false;
    setManagerOpen(true);
  }

  function reorderItems(sourceSlug: string, targetSlug: string) {
    if (sourceSlug === targetSlug) return;
    setManagedItems((prev) => {
      const sourceIndex = prev.findIndex((item) => item.slug === sourceSlug);
      const targetIndex = prev.findIndex((item) => item.slug === targetSlug);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return prev;
      const next = [...prev];
      const [picked] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, picked);
      hasDragOrderChangedRef.current = true;
      return next;
    });
  }

  useEffect(() => {
    draggingSlugRef.current = draggingSlug;
  }, [draggingSlug]);

  useEffect(() => {
    managedItemsRef.current = managedItems;
  }, [managedItems]);

  function moveDraggedItemByPointerY(pointerY: number) {
    const sourceSlug = draggingSlugRef.current;
    if (!sourceSlug) return;

    setManagedItems((prev) => {
      const sourceIndex = prev.findIndex((item) => item.slug === sourceSlug);
      if (sourceIndex < 0) return prev;

      let targetIndex = prev.length - 1;
      for (let index = 0; index < prev.length; index += 1) {
        const candidate = prev[index];
        if (candidate.slug === sourceSlug) continue;
        const node = itemElementMapRef.current.get(candidate.slug);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        if (pointerY < centerY) {
          targetIndex = index;
          break;
        }
      }

      if (targetIndex > sourceIndex) {
        targetIndex -= 1;
      }
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= prev.length) targetIndex = prev.length - 1;
      if (targetIndex === sourceIndex) return prev;

      const next = [...prev];
      const [picked] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, picked);
      hasDragOrderChangedRef.current = true;
      return next;
    });
  }

  const submitOrderIfChanged = useCallback(() => {
    const nextKey = toOrderKey(managedItemsRef.current);
    if (nextKey === lastSavedOrderKeyRef.current) return;
    lastSavedOrderKeyRef.current = nextKey;
    orderFormRef.current?.requestSubmit();
  }, []);

  const finalizeDrag = useCallback(() => {
    if (hasDragOrderChangedRef.current) {
      submitOrderIfChanged();
      hasDragOrderChangedRef.current = false;
    }
    activePointerIdRef.current = null;
    setDraggingSlug(null);
  }, [submitOrderIfChanged]);

  useEffect(() => {
    if (!draggingSlug) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      moveDraggedItemByPointerY(event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      finalizeDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingSlug, finalizeDrag]);

  useLayoutEffect(() => {
    if (!managerOpen) {
      previousTopBySlugRef.current = new Map();
      return;
    }

    const nextTopBySlug = new Map<string, number>();
    for (const item of managedItems) {
      const node = itemElementMapRef.current.get(item.slug);
      if (!node) continue;
      nextTopBySlug.set(item.slug, node.getBoundingClientRect().top);
    }

    const previousTopBySlug = previousTopBySlugRef.current;
    if (previousTopBySlug.size === 0) {
      previousTopBySlugRef.current = nextTopBySlug;
      return;
    }

    for (const item of managedItems) {
      const node = itemElementMapRef.current.get(item.slug);
      const previousTop = previousTopBySlug.get(item.slug);
      const nextTop = nextTopBySlug.get(item.slug);
      if (!node || typeof previousTop !== "number" || typeof nextTop !== "number") continue;

      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 1) continue;

      node.style.transition = "none";
      node.style.transform = `translateY(${deltaY}px)`;
      node.getBoundingClientRect();
      requestAnimationFrame(() => {
        node.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
        node.style.transform = "translateY(0)";
      });
    }

    previousTopBySlugRef.current = nextTopBySlug;
  }, [managedItems, managerOpen]);

  function closeManagerModal() {
    finalizeDrag();
    setManagerOpen(false);
  }

  return (
    <>
      <div className="admin-magazine-card-grid">
        {magazines.map((magazine) => (
          <article
            key={magazine.id}
            className="admin-magazine-card"
            role="button"
            tabIndex={0}
            onClick={() => setActiveId(magazine.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActiveId(magazine.id);
              }
            }}
            aria-label={`${magazine.name}の設定を開く`}
          >
            <div className="admin-magazine-card-thumb" aria-hidden="true">
              {magazine.thumbnail ? (
                <img src={`/thumbnails/${magazine.thumbnail}`} alt="" />
              ) : (
                <span className="material-symbols-outlined">collections_bookmark</span>
              )}
            </div>
            <h3 className="admin-magazine-card-title">{magazine.name}</h3>
          </article>
        ))}
      </div>

      {activeMagazine ? (
        <div className="admin-magazine-modal-backdrop" onClick={closeMagazineModal}>
          <section
            ref={settingsDialogRef}
            className="admin-magazine-settings-modal admin-content-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeMagazine.name}の設定`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>{activeMagazine.name}</h2>
              <button
                type="button"
                className="ghost letter-close-button"
                onClick={closeMagazineModal}
                aria-label="閉じる"
              >
                close
              </button>
            </div>

            <section className="admin-content-detail-section admin-thumb-section admin-magazine-editor-thumb-section">
              <div className="admin-thumb-preview admin-thumb-preview-wrap" aria-busy={thumbUploading}>
                <div className="admin-thumb-preview-fill">
                  {activeMagazine.thumbnail ? (
                    <img src={`/thumbnails/${activeMagazine.thumbnail}`} alt="" />
                  ) : (
                    <span className="meta">サムネイルなし</span>
                  )}
                </div>
                <div className="admin-thumb-overlay" role="group" aria-label="サムネイルの操作">
                  <label htmlFor={magazineThumbFileInputId} className="admin-thumb-overlay-btn">
                    {thumbUploading ? "…" : activeMagazine.thumbnail ? "変更" : "追加"}
                  </label>
                  {activeMagazine.thumbnail ? (
                    <button
                      type="button"
                      className="admin-thumb-overlay-btn"
                      disabled={thumbUploading}
                      onClick={async () => {
                        if (!activeMagazine.thumbnail) return;
                        setThumbError(null);
                        setThumbUploading(true);
                        try {
                          const del = await fetch("/api/admin/thumbnails", {
                            method: "DELETE",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filename: activeMagazine.thumbnail })
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
                          actionFd.set("id", activeMagazine.id);
                          actionFd.set("thumbnail", "");
                          await updateMagazineThumbnailAction(actionFd);
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
                  id={magazineThumbFileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="admin-upload-file-input"
                  disabled={thumbUploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file || !activeMagazine) return;
                    setThumbError(null);
                    setThumbUploading(true);
                    try {
                      if (activeMagazine.thumbnail) {
                        await fetch("/api/admin/thumbnails", {
                          method: "DELETE",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ filename: activeMagazine.thumbnail })
                        });
                      }
                      const fd = new FormData();
                      fd.set("file", file);
                      fd.set("prefix", `mag-${activeMagazine.id}`);
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
                      actionFd.set("id", activeMagazine.id);
                      actionFd.set("thumbnail", json.filename);
                      await updateMagazineThumbnailAction(actionFd);
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

            <button
              type="button"
              className="meta admin-magazine-usage-trigger"
              onClick={openManagerModal}
              aria-label={`${activeMagazine.name}に登録中の記事を管理`}
            >
              登録記事数: {(usageMap.get(activeMagazine.name) ?? 0) + (usageDeltaMap.get(activeMagazine.name) ?? 0)}
            </button>

            <section className="admin-content-detail-section">
              <form action={updateMagazineAction} className="admin-inline-form admin-inline-form-compact">
                <input type="hidden" name="id" value={activeMagazine.id} />
                <input type="hidden" name="previousName" value={activeMagazine.name} />
                <label>
                  マガジン名
                  <input name="name" defaultValue={activeMagazine.name} required />
                </label>
                <label>
                  説明
                  <textarea
                    name="description"
                    defaultValue={activeMagazine.description}
                    className="admin-magazine-description-input"
                    rows={6}
                  />
                </label>
              </form>
            </section>

            <section className="admin-content-detail-section">
              <form action={deleteMagazineAction} className="admin-inline-form">
                <input type="hidden" name="id" value={activeMagazine.id} />
                <input type="hidden" name="name" value={activeMagazine.name} />
                <button type="submit" className="admin-small-button" aria-label="マガジンを削除">
                  <span className="material-symbols-outlined admin-delete-icon" aria-hidden="true">
                    delete
                  </span>
                </button>
              </form>
            </section>
          </section>
        </div>
      ) : null}

      {activeMagazine && managerOpen ? (
        <div className="admin-magazine-modal-backdrop" onClick={closeManagerModal}>
          <section
            ref={managerDialogRef}
            className="admin-magazine-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeMagazine.name}に登録中の記事管理`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>{activeMagazine.name}の登録記事</h2>
              <button
                type="button"
                className="ghost letter-close-button"
                onClick={closeManagerModal}
                aria-label="閉じる"
              >
                close
              </button>
            </div>

            <p className="meta">ドラッグで並び替え、変更は自動保存されます。解除もできます。</p>

            {managedItems.length === 0 ? (
              <p className="meta">登録中の記事はありません。</p>
            ) : (
              <>
                <ul className="admin-magazine-content-manage-list" aria-label="登録中の記事一覧">
                  {managedItems.map((item) => (
                    <li
                      key={item.slug}
                      className={`admin-magazine-content-manage-item${draggingSlug === item.slug ? " is-dragging" : ""}`}
                      ref={(node) => {
                        if (node) {
                          itemElementMapRef.current.set(item.slug, node);
                        } else {
                          itemElementMapRef.current.delete(item.slug);
                        }
                      }}
                    >
                      <div className="admin-magazine-content-item-main">
                        <span>{item.title}</span>
                        {item.slug !== item.title ? <span className="meta">{item.slug}</span> : null}
                      </div>
                      <div className="admin-magazine-content-item-actions">
                        <button
                          type="button"
                          className="admin-drag-handle-button"
                          aria-label={`${item.title}をドラッグして並び替え`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            activePointerIdRef.current = event.pointerId;
                            setDraggingSlug(item.slug);
                          }}
                        >
                          <span className="material-symbols-outlined admin-drag-handle" aria-hidden="true">
                            drag_indicator
                          </span>
                        </button>
                        <form action={removeContentFromMagazineAction} className="admin-inline-form">
                          <input type="hidden" name="magazineName" value={activeMagazine.name} />
                          <input type="hidden" name="slug" value={item.slug} />
                          <button
                            type="submit"
                            className="admin-small-button"
                            aria-label={`${item.title}を登録解除`}
                            onClick={() => {
                              setManagedItems((prev) => prev.filter((row) => row.slug !== item.slug));
                              setUsageDeltaMap((prev) => {
                                const next = new Map(prev);
                                const currentDelta = next.get(activeMagazine.name) ?? 0;
                                next.set(activeMagazine.name, currentDelta - 1);
                                return next;
                              });
                            }}
                          >
                            解除
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>

                <form ref={orderFormRef} action={updateMagazineContentOrderAction}>
                  <input type="hidden" name="magazineName" value={activeMagazine.name} />
                  {managedItems.map((item) => (
                    <input key={`order-${item.slug}`} type="hidden" name="orderedSlugs" value={item.slug} />
                  ))}
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
