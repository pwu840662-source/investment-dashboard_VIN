import type { QuoteRow } from "../api/marketData";

export type Direction = "up" | "down" | "flat" | "unknown";

/** 當日漲跌：視為平盤的門檻（％） */
const DAY_FLAT_ABS = 0.06;
/** 走勢圖區間報酬：判斷偏多／偏空的門檻（％），對應約一個月的累積變動 */
const SPARK_BAND_ABS = 1.5;

export function classifyDirection(row: QuoteRow): Direction {
  if (row.status !== "ok" || row.price == null) return "unknown";
  if (row.changePct != null && !Number.isNaN(row.changePct)) {
    if (row.changePct > DAY_FLAT_ABS) return "up";
    if (row.changePct < -DAY_FLAT_ABS) return "down";
    return "flat";
  }
  const pct = sparklineReturnPct(row);
  if (pct == null) return "unknown";
  if (pct > SPARK_BAND_ABS) return "up";
  if (pct < -SPARK_BAND_ABS) return "down";
  return "flat";
}

/** 近似近走勢序列的區間報酬％（僅示意） */
export function sparklineReturnPct(row: QuoteRow): number | null {
  const s = row.sparkline;
  if (!s || s.length < 2) return null;
  const a = s[0];
  const b = s[s.length - 1];
  if (a === 0 || Number.isNaN(a) || Number.isNaN(b)) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

export function directionLabelZh(d: Direction): string {
  switch (d) {
    case "up":
      return "偏多";
    case "down":
      return "偏弱";
    case "flat":
      return "盤整";
    default:
      return "—";
  }
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function slopePct(values: number[], lookback: number): number | null {
  if (values.length < lookback) return null;
  const a = values[values.length - lookback];
  const b = values[values.length - 1];
  if (a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

export interface TechnicalRead {
  short: string;
  detail: string;
}

/** 以近一個月序列做簡化線型判讀（MA5/MA10、斜率、價格位置） */
export function technicalPattern(row: QuoteRow): TechnicalRead | null {
  const s = row.sparkline;
  if (!s || s.length < 10) return null;
  const last = s[s.length - 1];
  const ma5 = sma(s, 5);
  const ma10 = sma(s, 10);
  const slope5 = slopePct(s, 5);
  if (ma5 == null || ma10 == null || slope5 == null) return null;

  const maGap = ((ma5 - ma10) / Math.abs(ma10)) * 100;
  const aboveMa5 = last >= ma5;

  if (maGap > 0.5 && slope5 > 0.5 && aboveMa5) {
    return {
      short: "多頭延續",
      detail: "MA5 在 MA10 之上，且短斜率向上，價格位於短均線上方。",
    };
  }
  if (maGap < -0.5 && slope5 < -0.5 && !aboveMa5) {
    return {
      short: "空頭延續",
      detail: "MA5 在 MA10 之下，且短斜率向下，價格位於短均線下方。",
    };
  }
  if (Math.abs(maGap) <= 0.35 && Math.abs(slope5) <= 0.45) {
    return {
      short: "區間整理",
      detail: "短中均線靠攏，短期斜率接近平緩，趨勢尚未明確。",
    };
  }
  if (maGap > 0 && slope5 < 0) {
    return {
      short: "多頭回踩",
      detail: "均線結構仍偏多，但短期動能轉弱，留意支撐是否守住。",
    };
  }
  if (maGap < 0 && slope5 > 0) {
    return {
      short: "空頭反彈",
      detail: "均線結構仍偏弱，但短期動能回升，觀察是否能站上中均線。",
    };
  }
  return {
    short: "方向觀望",
    detail: "均線與斜率訊號分歧，建議等待更清晰突破/跌破。",
  };
}

/** 將列分組供段落敘述 */
export function groupedIds(): Record<
  string,
  { title: string; ids: readonly string[]; note?: string }
> {
  return {
    tw: {
      title: "台股指標",
      ids: ["twii", "tw"],
      note: "加權指數反映整體大盤；個股與指數連動並非必然。",
    },
    fx: {
      title: "匯率",
      ids: ["usd"],
      note: "美元走強時，數字上升代表同額美元可兌換較多新台幣。",
    },
    cmdty: {
      title: "原物料（期貨）",
      ids: ["gold", "oil"],
      note: "以美元計價的期貨參考價；與實質供需、地緣與利率預期相關。",
    },
    crypto: {
      title: "數位資產",
      ids: ["btc"],
      note: "波動大、流動性與監管事件影響顯著，宜控管資金比重。",
    },
  };
}
