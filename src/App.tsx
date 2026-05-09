import { useCallback, useEffect, useState } from "react";
import { fetchAllQuotes, type QuoteRow } from "./api/marketData";
import { InstallAppBanner } from "./components/InstallAppBanner";
import { InvestmentAnalysis } from "./components/InvestmentAnalysis";
import { QuoteCard } from "./components/QuoteCard";

const REFRESH_MS = 60_000;

export default function App() {
  const [rows, setRows] = useState<QuoteRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const data = await fetchAllQuotes();
      setRows(data);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "重新整理失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1.25rem 3rem" }}>
      <header style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.65rem", fontWeight: 700, margin: "0 0 0.35rem", letterSpacing: "-0.02em" }}>
          多市場投資看板
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
          台股加權指數、台股個股、匯率、黃金、比特幣、原油 — 資料來源請見各卡片。約每分鐘自動重新整理。
        </p>
        <InstallAppBanner />

        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              background: "var(--accent)",
              color: "#0c0f14",
              border: "none",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              fontSize: "0.9rem",
            }}
          >
            {loading ? "重新整理中…" : "立即重新整理"}
          </button>
          {lastError && (
            <span style={{ color: "var(--down)", fontSize: "0.85rem" }}>{lastError}</span>
          )}
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {rows?.map((r) => (
          <QuoteCard key={r.id} row={r} />
        ))}
        {!rows && loading && (
          <div style={{ color: "var(--muted)", gridColumn: "1 / -1" }}>正在取得報價…</div>
        )}
      </section>

      {rows && rows.length > 0 ? <InvestmentAnalysis rows={rows} /> : null}

      <footer style={{ marginTop: "2.5rem", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong>說明：</strong>
          本站為<strong>漸進式網頁應用（PWA）</strong>：可安裝到桌面或手機主畫面，離線仍可開啟已快取的版面（報價需連網）。
          Yahoo 與 Frankfurter 在開發模式下會透過 Vite 代理請求；部署到公開網路時需自建反向代理，或改用支援 CORS
          的商用 API。美元／新台幣使用 Frankfurter v2（api.frankfurter.dev）；若失敗會自動改用 Open ER API。比特幣（CoinGecko）在開發模式下亦經 Vite 代理。走勢圖：Yahoo
          項目為近一個月日線收盤；美元／新台幣為 Frankfurter 每日匯率；比特幣為 CoinGecko 近 30 日價格序列。
        </p>
        <p style={{ margin: 0 }}>
          加權指數為 <code className="mono" style={{ color: "var(--accent)" }}>^TWII</code>，個股範例為台積電（
          <code className="mono" style={{ color: "var(--accent)" }}>2330.TW</code>）；皆可在{" "}
          <code style={{ color: "var(--accent)" }}>src/api/marketData.ts</code> 更換代號。
        </p>
      </footer>
    </div>
  );
}
