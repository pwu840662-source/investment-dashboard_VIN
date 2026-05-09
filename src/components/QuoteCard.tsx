import type { QuoteRow } from "../api/marketData";
import { Sparkline } from "./Sparkline";

function formatPrice(n: number, currency: string): string {
  if (currency === "TWD" && n > 100) return n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function QuoteCard({ row }: { row: QuoteRow }) {
  const up = row.changePct != null && row.changePct > 0;
  const down = row.changePct != null && row.changePct < 0;
  const changeColor =
    row.changePct == null ? "var(--muted)" : up ? "var(--up)" : down ? "var(--down)" : "var(--muted)";

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        minHeight: 168,
      }}
    >
      <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>{row.label}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
        {row.symbol}
        {row.unit ? ` · ${row.unit}` : ""}
      </div>
      {row.status === "ok" && row.price != null ? (
        <>
          <div className="mono" style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            {formatPrice(row.price, row.currency)}{" "}
            <span style={{ fontSize: "0.95rem", color: "var(--muted)", fontWeight: 500 }}>{row.currency}</span>
          </div>
          {row.sparkline != null && row.sparkline.length >= 2 ? (
            <div style={{ margin: "-0.15rem 0 0" }}>
              <Sparkline values={row.sparkline} />
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "-0.2rem" }}>
                近 1 個月走勢
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="mono" style={{ color: changeColor, fontWeight: 600 }}>
              {formatChange(row.changePct)}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {row.source}
              {row.updatedAt ? ` · ${new Date(row.updatedAt).toLocaleTimeString("zh-TW")}` : ""}
            </span>
          </div>
        </>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          {row.error ?? "載入失敗"}
        </div>
      )}
    </article>
  );
}
