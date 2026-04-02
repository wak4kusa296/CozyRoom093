"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function MagazineMultiToggle({
  options,
  initialSelected
}: {
  options: string[];
  initialSelected: string[];
}) {
  const normalizedInitial = useMemo(
    () => Array.from(new Set(initialSelected.filter((item) => options.includes(item)))),
    [initialSelected, options]
  );
  const [selected, setSelected] = useState<string[]>(normalizedInitial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelected(normalizedInitial);
  }, [normalizedInitial]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function toggleMagazine(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  }

  function hasSelectionChanged() {
    const a = [...selected].sort((x, y) => x.localeCompare(y, "ja")).join("\n");
    const b = [...normalizedInitial].sort((x, y) => x.localeCompare(y, "ja")).join("\n");
    return a !== b;
  }

  function closeModal(saveOnClose: boolean) {
    setOpen(false);
    if (!saveOnClose || !hasSelectionChanged()) return;

    const form = rootRef.current?.closest("form");
    if (form && form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }

  const triggerLabel = selected.length > 0 ? selected.join(" / ") : "未選択";

  return (
    <div ref={rootRef}>
      <button type="button" className="admin-multi-popup-trigger" onClick={() => setOpen(true)} aria-label="登録マガジンを選択">
        {triggerLabel}
      </button>

      {selected.map((magazine) => (
        <input key={magazine} type="hidden" name="magazines" value={magazine} />
      ))}

      {open ? (
        <div className="admin-magazine-modal-backdrop" onClick={() => closeModal(true)}>
          <section
            className="admin-magazine-modal"
            role="dialog"
            aria-modal="true"
            aria-label="登録マガジンの選択"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="letter-modal-header">
              <h2>登録マガジン</h2>
              <button type="button" className="ghost letter-close-button" onClick={() => closeModal(true)} aria-label="閉じる">
                close
              </button>
            </div>
            <p className="meta">紐付けたいマガジンを複数選択できます。</p>
            <div className="admin-magazine-toggle-grid">
              {options.length === 0 ? (
                <p className="meta">マガジンがありません。</p>
              ) : (
                options.map((magazine) => {
                  const active = selected.includes(magazine);
                  return (
                    <button
                      key={magazine}
                      type="button"
                      className={`admin-magazine-toggle${active ? " admin-magazine-toggle-active" : ""}`}
                      onClick={() => toggleMagazine(magazine)}
                      aria-pressed={active}
                    >
                      <span className="admin-magazine-toggle-label">{magazine}</span>
                      <span className={`admin-magazine-toggle-state${active ? " is-active" : ""}`}>
                        {active ? "選択中" : "未選択"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
