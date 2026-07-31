"use client";

import { RefObject, useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * モーダル用フォーカストラップ。
 * - モーダルが開いたとき最初のフォーカス可能要素にフォーカスを移動
 * - Tab / Shift+Tab をモーダル内に閉じ込める
 * - Escape キーで onClose を呼び出す
 * - モーダルが閉じたときトリガー要素にフォーカスを戻す
 */
export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  restoreFocus: () => boolean = () => true
) {
  const triggerRef = useRef<Element | null>(null);
  /*
   * onClose は呼び出し側でインライン関数として渡されることが多く、毎レンダーで別物になる。
   * 依存に入れるとキー入力のたびに effect が張り直され、初期フォーカスが再実行されて
   * 入力欄からフォーカスが外れる（モバイルではキーボードが閉じる）。
   */
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef(restoreFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    restoreFocusRef.current = restoreFocus;
  }, [restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;

    const el = dialogRef.current;
    if (!el) return;

    const getFocusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (e) => !e.closest("[hidden]")
      );

    getFocusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocusRef.current() && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, dialogRef]);
}
