"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwa-install-banner-dismissed";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ios" | "chrome" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
    setMode(null);
    setDeferred(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (isDismissedRecently()) return;

    /* マウス操作の広い画面では出さない（スマホ・タブレット向け） */
    const desktopLike =
      window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900;
    if (desktopLike) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onInstalled = () => {
      setOpen(false);
      setMode(null);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    if (isIOSDevice()) {
      queueMicrotask(() => {
        setMode("ios");
        setOpen(true);
      });
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEventLike);
      setMode("chrome");
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ユーザーが閉じたなど */
    }
    setDeferred(null);
    setOpen(false);
    setMode(null);
  }, [deferred]);

  if (!open || !mode) return null;

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="ホーム画面への追加">
      <div className="pwa-install-banner-inner">
        <div className="pwa-install-banner-head">
          <img
            className="pwa-install-banner-app-icon"
            src="/icon-192.png"
            alt=""
            width={44}
            height={44}
            decoding="async"
          />
          <div className="pwa-install-banner-head-text">
            <p className="pwa-install-banner-title">ホームに追加</p>
            <p className="pwa-install-banner-lead">
              {mode === "ios"
                ? "2ステップで、アプリのように開けます。"
                : "ボタン1つで、ホームからすぐ開けます。"}
            </p>
          </div>
        </div>

        {mode === "ios" ? (
          <div className="pwa-install-ios-flow" aria-label="追加の手順">
            <div className="pwa-install-flow-step">
              <span className="material-symbols-outlined pwa-install-flow-ico" aria-hidden="true">
                ios_share
              </span>
              <p className="pwa-install-flow-copy">
                画面下の
                <strong>共有</strong>
                をタップ
              </p>
            </div>
            <div className="pwa-install-flow-connector" aria-hidden="true">
              <span className="material-symbols-outlined">arrow_downward</span>
            </div>
            <div className="pwa-install-flow-step">
              <span className="material-symbols-outlined pwa-install-flow-ico" aria-hidden="true">
                add_to_home_screen
              </span>
              <p className="pwa-install-flow-copy">
                <strong>ホーム画面に追加</strong>
                をタップ
                <span className="pwa-install-flow-note">（見つからないときは共有シートを下にスクロール）</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="pwa-install-chrome-hint">
            <span className="material-symbols-outlined pwa-install-chrome-ico" aria-hidden="true">
              install_mobile
            </span>
            <p className="pwa-install-chrome-text">
              <strong>インストール</strong>
              でホーム画面に追加できます。
            </p>
          </div>
        )}

        <div className="pwa-install-banner-actions">
          <button type="button" className="pwa-install-banner-secondary" onClick={dismiss}>
            <span className="material-symbols-outlined pwa-install-btn-ico" aria-hidden="true">
              close
            </span>
            閉じる
          </button>
          {mode === "chrome" && deferred ? (
            <button type="button" className="pwa-install-banner-primary" onClick={onInstallClick}>
              <span className="material-symbols-outlined pwa-install-btn-ico" aria-hidden="true">
                install_mobile
              </span>
              インストール
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
