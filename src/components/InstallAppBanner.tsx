import { useCallback, useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "pwa-install-hint-dismissed";

/** Chromium「安裝 PWA」事件（非標準，型別未入 DOM lib） */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iPad || /iPhone|iPad|iPod/.test(ua);
}

function isStandalone(): boolean {
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const apple = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || apple;
}

export function InstallAppBanner() {
  const [standalone] = useState(isStandalone);
  const [ios] = useState(isIos());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (standalone) return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [standalone]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const installChrome = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  const showInstallRow = useMemo(() => !standalone && !dismissed, [standalone, dismissed]);

  const needIosHint = ios && !deferred && !standalone;

  if (!showInstallRow) return null;

  return (
    <div
      role="region"
      aria-label="安裝應用程式"
      style={{
        marginTop: "0.85rem",
        padding: "0.65rem 0.85rem",
        borderRadius: 8,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem 0.65rem",
        fontSize: "0.875rem",
        color: "var(--muted)",
      }}
    >
      <span style={{ color: "var(--text)", fontWeight: 600 }}>安裝成 App</span>
      <span style={{ flex: "1 1 180px", minWidth: 0 }}>
        {deferred ? "將看板加到桌面或開始選單，可像原生 App 一樣全螢幕開啟並離線載入版面。" : needIosHint
          ? "在 Safari：點「分享 □↑」→「加入主畫面」。電腦版 Chrome／Edge：網址列右側會出現「安裝」圖示。"
          : "使用 Chrome／Edge 時可由瀏覽器提示「安裝」；或由選單（⋮）→「安裝多市場投資看板」。"}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        {deferred ? (
          <button
            type="button"
            onClick={() => void installChrome()}
            style={{
              background: "var(--accent)",
              color: "#0c0f14",
              border: "none",
              borderRadius: 8,
              padding: "0.35rem 0.85rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            安裝到裝置
          </button>
        ) : needIosHint ? (
          <button
            type="button"
            onClick={() => setHintOpen((o) => !o)}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.35rem 0.75rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {hintOpen ? "收合說明" : "iPhone／iPad 步驟"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: "transparent",
            color: "var(--muted)",
            border: "none",
            fontSize: "0.82rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          不用再顯示
        </button>
      </div>
      {hintOpen && needIosHint ? (
        <ol style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem", width: "100%", lineHeight: 1.65 }}>
          <li>請用 Safari 開啟本網站（勿用嵌入瀏覽器）。</li>
          <li>點畫面底或頂端的「分享」圖示（方塊向上箭頭）。</li>
          <li>向下捲動點選「加入主畫面」→「加入」。</li>
        </ol>
      ) : null}
    </div>
  );
}
