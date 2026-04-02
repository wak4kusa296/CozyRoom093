"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RecoveryGuestOption = { guestId: string; guestName: string };

function labelFor(g: RecoveryGuestOption) {
  return g.guestName === g.guestId ? g.guestId : `${g.guestName} · ${g.guestId}`;
}

export function RecoveryGuestPicker(props: {
  rowId: string;
  options: RecoveryGuestOption[];
  value: string;
  onChange: (guestId: string) => void;
}) {
  const { rowId, options, value, onChange } = props;
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = options.find((o) => o.guestId === value);
  const displayText = value && selected ? labelFor(selected) : "選択";

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updatePos();
  }, [menuOpen, updatePos]);

  useEffect(() => {
    if (!menuOpen) return;
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [menuOpen, updatePos]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const listboxId = `recovery-guest-listbox-${rowId}`;
  const labelId = `${listboxId}-caption`;

  return (
    <div className="admin-notification-guest-pick">
      <div className="admin-notification-guest-pick-label" id={labelId}>
        送る相手
      </div>
      <button
        ref={triggerRef}
        type="button"
        className={`admin-notification-guest-trigger${menuOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-labelledby={labelId}
        aria-controls={listboxId}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span
          className={
            value && selected
              ? "admin-notification-guest-trigger-text"
              : "admin-notification-guest-trigger-text admin-notification-guest-trigger-text--placeholder"
          }
        >
          {displayText}
        </span>
        <span className="material-symbols-outlined admin-notification-guest-trigger-caret" aria-hidden>
          expand_more
        </span>
      </button>
      {mounted && menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              className="admin-notification-guest-menu"
              role="listbox"
              aria-labelledby={labelId}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 168),
                zIndex: 400
              }}
            >
              <button
                type="button"
                role="option"
                className={`admin-notification-guest-option${!value ? " is-active" : ""}`}
                aria-selected={!value}
                onClick={() => {
                  onChange("");
                  setMenuOpen(false);
                }}
              >
                選択
              </button>
              {options.map((g) => (
                <button
                  key={g.guestId}
                  type="button"
                  role="option"
                  className={`admin-notification-guest-option${value === g.guestId ? " is-active" : ""}`}
                  aria-selected={value === g.guestId}
                  onClick={() => {
                    onChange(g.guestId);
                    setMenuOpen(false);
                  }}
                >
                  {labelFor(g)}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
