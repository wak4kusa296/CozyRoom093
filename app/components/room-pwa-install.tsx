"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function RoomPwaInstall() {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    setStandalone(isStandalonePwa());
    setIos(isIosDevice());
    setReady(true);

    function onBip(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const visible = ready && !standalone && (ios || deferredPrompt !== null);

  useLayoutEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (iosModalOpen) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [iosModalOpen]);

  const onInstallClick = useCallback(() => {
    if (ios) {
      setIosModalOpen(true);
      return;
    }
    if (!deferredPrompt) return;
    void (async () => {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    })();
  }, [ios, deferredPrompt]);

  const closeModal = useCallback(() => {
    setIosModalOpen(false);
  }, []);

  if (!visible) return null;

  const modal = iosModalOpen
    ? createPortal(
      <dialog
        ref={dialogRef}
        className="room-pwa-install-dialog"
        aria-labelledby="room-pwa-install-dialog-title"
        onClose={closeModal}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="room-pwa-install-dialog-inner">
          <h2 id="room-pwa-install-dialog-title" className="room-pwa-install-dialog-title">
            ホーム画面に追加
          </h2>
          <p className="room-pwa-install-dialog-lead">
            ホーム画面に追加すると、アプリのようにすばやく開けます。
          </p>
          <ol className="room-pwa-install-dialog-steps">
            <li>画面下の<strong>共有</strong>ボタン（□に矢印）をタップします。</li>
            <li>一覧から<strong>ホーム画面に追加</strong>を選びます。</li>
            <li>右上の<strong>追加</strong>で確定します。</li>
          </ol>
          <p className="room-pwa-install-dialog-note">
            表示や文言は iOS のバージョンによって少し異なることがあります。
          </p>
          <button type="button" className="room-pwa-install-dialog-close" onClick={closeModal}>
            閉じる
          </button>
        </div>
      </dialog>,
      document.body
    )
    : null;

  return (
    <>
      <button type="button" className="room-pwa-install" onClick={onInstallClick}>
        <span className="material-symbols-outlined room-pwa-install-icon" aria-hidden="true">
          install_mobile
        </span>
        <span>インストールする</span>
      </button>
      {modal}
    </>
  );
}
