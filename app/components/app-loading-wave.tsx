export function AppLoadingWave({
  fullscreen = false,
  className = "",
  label = "読み込み中"
}: {
  /** ルート loading.tsx 用：画面全体を埋める */
  fullscreen?: boolean;
  className?: string;
  /** aria-label */
  label?: string;
}) {
  return (
    <div
      className={`app-loading-wave${fullscreen ? " app-loading-wave--fullscreen" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="app-loading-wave-dot" />
      <span className="app-loading-wave-dot" />
      <span className="app-loading-wave-dot" />
    </div>
  );
}

/** フォーム送信中など：半透明オーバーレイ＋ウェーブ */
export function AppLoadingOverlay({
  label = "読み込み中",
  zIndex = 2000
}: {
  label?: string;
  zIndex?: number;
}) {
  return (
    <div
      className="app-loading-overlay"
      aria-hidden="true"
      style={{ zIndex }}
    >
      <AppLoadingWave label={label} />
    </div>
  );
}
