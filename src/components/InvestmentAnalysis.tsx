import type { QuoteRow } from "../api/marketData";
import {
  classifyDirection,
  directionLabelZh,
  groupedIds,
  sparklineReturnPct,
  technicalPattern,
  type Direction,
} from "../analysis/insights";

function dirColor(d: Direction): string {
  if (d === "up") return "var(--up)";
  if (d === "down") return "var(--down)";
  if (d === "flat") return "var(--muted)";
  return "var(--muted)";
}

function formatDelta(row: QuoteRow): string {
  if (row.changePct != null && !Number.isNaN(row.changePct)) {
    const s = row.changePct > 0 ? "+" : "";
    return `${s}${row.changePct.toFixed(2)}%（當日）`;
  }
  const r = sparklineReturnPct(row);
  if (r != null) {
    const s = r > 0 ? "+" : "";
    return `${s}${r.toFixed(2)}%（走勢區間）`;
  }
  return "—";
}

export function InvestmentAnalysis({ rows }: { rows: QuoteRow[] }) {
  const byId = Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, QuoteRow>;
  const groups = groupedIds();

  const okRows = rows.filter((r) => r.status === "ok" && r.price != null);
  const withDir = okRows.map((r) => ({ row: r, dir: classifyDirection(r) }));
  const ups = withDir.filter((x) => x.dir === "up").length;
  const downs = withDir.filter((x) => x.dir === "down").length;
  const flats = withDir.filter((x) => x.dir === "flat").length;

  let breadthLine = "資料不足，暫無法摘要盤面。";
  if (okRows.length > 0) {
    breadthLine = `在此六檔可讀報價中：偏多 ${ups}、偏弱 ${downs}、盤整或變化不大 ${flats}。此為即時快照看板，非完整市場涵蓋。`;
  }

  const twii = byId.twii;
  const tw = byId.tw;
  let twNarrative = "";
  if (twii?.status === "ok" && tw?.status === "ok") {
    const d1 = classifyDirection(twii);
    const d2 = classifyDirection(tw);
    if (d1 === d2 && d1 !== "unknown")
      twNarrative = `加權與台積電方向一致（皆為${directionLabelZh(d1)}），大盤與權值股表現同步。`;
    else if (d1 !== "unknown" && d2 !== "unknown")
      twNarrative = `加權為${directionLabelZh(d1)}、台積電為${directionLabelZh(d2)}，權值股與大盤節奏分化，可留意題材與資金輪動。`;
  } else if (twii?.status === "ok")
    twNarrative = `僅有加權指數可判讀，宜待個股資料就緒再一併觀察。`;
  else if (tw?.status === "ok")
    twNarrative = `僅有個股資料可判讀，宜對照指數以降低單標的噪聲。`;

  let cmdtyLine = "";
  const gAu = byId.gold;
  const oil = byId.oil;
  if (gAu?.status === "ok" || oil?.status === "ok") {
    const gD = gAu?.status === "ok" ? classifyDirection(gAu) : "unknown";
    const oD = oil?.status === "ok" ? classifyDirection(oil) : "unknown";
    const bits: string[] = [];
    if (gAu?.status === "ok") bits.push(`黃金 ${directionLabelZh(gD)}`);
    if (oil?.status === "ok") bits.push(`原油 ${directionLabelZh(oD)}`);
    cmdtyLine = `${bits.join("；")}。能源與貴金屬對通膨、地緣與美元指數敏感，適合用作風險情緒的交叉參考。`;
  }

  return (
    <section
      style={{
        marginTop: "2.25rem",
        padding: "1.35rem 1.4rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          margin: "0 0 1rem",
          letterSpacing: "-0.02em",
        }}
      >
        投資分析
      </h2>

      <p style={{ margin: "0 0 1rem", color: "var(--text)", lineHeight: 1.65, fontSize: "0.95rem" }}>
        {breadthLine}
      </p>

      {twNarrative ? (
        <p style={{ margin: "0 0 1rem", color: "var(--text)", lineHeight: 1.65, fontSize: "0.95rem" }}>
          <strong style={{ color: "var(--accent)" }}>台股：</strong>
          {twNarrative}
        </p>
      ) : null}

      {cmdtyLine ? (
        <p style={{ margin: "0 0 1rem", color: "var(--text)", lineHeight: 1.65, fontSize: "0.95rem" }}>
          <strong style={{ color: "var(--accent)" }}>大宗物資：</strong>
          {cmdtyLine}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
        {Object.entries(groups).map(([key, meta]) => (
          <div
            key={key}
            style={{
              padding: "0.85rem 1rem",
              background: "#0f1319",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.5rem" }}>{meta.title}</div>
            {meta.ids.map((id) => {
              const row = byId[id];
              if (!row)
                return (
                  <div key={id} style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    （缺少資料）
                  </div>
                );
              const dir = classifyDirection(row);
              const tech = technicalPattern(row);
              return (
                <div
                  key={id}
                  style={{
                    fontSize: "0.82rem",
                    marginBottom: "0.35rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem 0.65rem",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: "var(--muted)", minWidth: "7rem" }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: dirColor(dir) }}>{directionLabelZh(dir)}</span>
                  <span className="mono" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    {formatDelta(row)}
                  </span>
                  {tech ? (
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--accent)",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "0.05rem 0.45rem",
                      }}
                      title={tech.detail}
                    >
                      線型：{tech.short}
                    </span>
                  ) : null}
                  {row.status !== "ok" ? (
                    <span style={{ color: "var(--down)" }}>（{row.error ?? "無報價"}）</span>
                  ) : null}
                </div>
              );
            })}
            {meta.note ? (
              <p style={{ margin: "0.55rem 0 0", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.55 }}>
                {meta.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "0.76rem",
          color: "var(--muted)",
          lineHeight: 1.6,
          borderTop: "1px solid var(--border)",
          paddingTop: "0.85rem",
        }}
      >
        <strong>免責與備註：</strong>
        以上為依本頁即時資料自動生成的<strong>示意性整理與資訊彙總</strong>
        ，不構成投資／法律／稅務建議，亦非個別標的推介。線型判讀基於近一月序列的簡化均線模型（MA5/MA10 與短斜率），僅供觀察趨勢節奏。
        走勢圖區間報酬為序列首尾粗估百分比，與總報酬／年化無關。
        實際投資請自行查證、評估稅務與法規並控管部位。
      </p>
    </section>
  );
}
