export type QuoteStatus = "ok" | "error";

export interface QuoteRow {
  id: string;
  label: string;
  symbol: string;
  price: number | null;
  changePct: number | null;
  currency: string;
  unit?: string;
  source: string;
  updatedAt: string | null;
  status: QuoteStatus;
  error?: string;
  /** 走勢序列（時間由左至右）；資料來源見各 fetch */
  sparkline?: number[] | null;
}

function basePath(name: "yahoo" | "frankfurter" | "coingecko"): string {
  // dev：用 Vite proxy；prod：用同源 Serverless proxy（方便部署後仍可讀取資料，避免 CORS）
  if (import.meta.env.DEV) return `/${name}`;
  return `/api/proxy/${name}`;
}

const yahooPath = (symbol: string) =>
  `${basePath("yahoo")}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

const yahooSparkPath = (symbol: string) =>
  `${basePath("yahoo")}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;

function frankfurterUrl(pathQuery: string): string {
  const path = pathQuery.startsWith("/") ? pathQuery : `/${pathQuery}`;
  return import.meta.env.DEV ? `${basePath("frankfurter")}${path}` : `${basePath("frankfurter")}${path}`;
}

/** CoinGecko：開發走 Vite proxy；正式走同源 proxy */
function coingeckoUrl(pathQuery: string): string {
  const path = pathQuery.startsWith("/") ? pathQuery : `/${pathQuery}`;
  return `${basePath("coingecko")}${path}`;
}

function parseYahooJson(data: unknown): {
  price: number;
  prev: number;
  currency: string;
} | null {
  const d = data as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          currency?: string;
        };
      }>;
    };
  };
  const meta = d.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;
  const prev =
    meta.previousClose ??
    meta.chartPreviousClose ??
    meta.regularMarketPrice;
  return {
    price: meta.regularMarketPrice,
    prev,
    currency: meta.currency ?? "USD",
  };
}

async function fetchYahoo(symbol: string): Promise<{
  price: number;
  changePct: number;
  currency: string;
}> {
  const res = await fetch(yahooPath(symbol));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const p = parseYahooJson(json);
  if (!p) throw new Error("無法解析報價");
  const changePct = ((p.price - p.prev) / p.prev) * 100;
  return { price: p.price, changePct, currency: p.currency };
}

/** Yahoo Chart：近約 1 個月日線收盤（略過 null） */
async function fetchYahooSparkline(symbol: string): Promise<number[]> {
  const res = await fetch(yahooSparkPath(symbol));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const closes = (json as {
    chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  }).chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!closes?.length) throw new Error("無走勢資料");
  const nums = closes.filter((c): c is number => c != null && !Number.isNaN(c));
  if (nums.length < 2) throw new Error("走勢點數不足");
  return nums;
}

async function fetchYahooQuoteWithSparkline(symbol: string): Promise<{
  quote: Awaited<ReturnType<typeof fetchYahoo>>;
  sparkline: number[] | null;
}> {
  const [qRes, sRes] = await Promise.allSettled([
    fetchYahoo(symbol),
    fetchYahooSparkline(symbol),
  ]);
  if (qRes.status === "rejected") throw qRes.reason;
  const quote = qRes.value;
  let sparkline: number[] | null = null;
  if (sRes.status === "fulfilled" && sRes.value.length >= 2) sparkline = sRes.value;
  return { quote, sparkline };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Frankfurter v2：區間內每日 USD/TWD */
async function fetchUsdTwdSparklineRates(): Promise<number[]> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 40);
  const qs = `base=USD&quotes=TWD&from=${isoDate(from)}&to=${isoDate(to)}`;
  const url = `${frankfurterUrl(`/v2/rates?${qs}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ rate?: number }>;
  const rates = rows.map((r) => r.rate).filter((r): r is number => r != null && !Number.isNaN(r));
  if (rates.length < 2) throw new Error("匯率走勢資料不足");
  return rates;
}

async function fetchBitcoinSparklineUsd(): Promise<number[]> {
  const res = await fetch(
    coingeckoUrl(
      "/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30"
    )
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { prices?: [number, number][] };
  const pts = json.prices ?? [];
  const ys = pts.map((p) => p[1]).filter((n) => !Number.isNaN(n));
  if (ys.length < 2) throw new Error("BTC 走勢資料不足");
  return ys;
}

function isRateLimitedError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /HTTP 429/i.test(e.message);
}

/** Binance 備援：24h 統計（USD 以 USDT 近似） */
async function fetchBitcoinFromBinance(): Promise<{
  price: number;
  changePct: number | null;
  sparkline: number[] | null;
}> {
  const tickerRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
  if (!tickerRes.ok) throw new Error(`HTTP ${tickerRes.status}`);
  const ticker = (await tickerRes.json()) as {
    lastPrice?: string;
    priceChangePercent?: string;
  };
  const price = Number(ticker.lastPrice);
  const changePct = Number(ticker.priceChangePercent);
  if (Number.isNaN(price)) throw new Error("無 BTC 資料");

  // 嘗試補 30 天走勢；失敗不阻斷主報價
  let sparkline: number[] | null = null;
  try {
    const kRes = await fetch(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=30"
    );
    if (kRes.ok) {
      const rows = (await kRes.json()) as Array<[number, string, string, string, string]>;
      const close = rows
        .map((r) => Number(r[4]))
        .filter((n) => !Number.isNaN(n));
      if (close.length >= 2) sparkline = close;
    }
  } catch {
    sparkline = null;
  }

  return {
    price,
    changePct: Number.isNaN(changePct) ? null : changePct,
    sparkline,
  };
}

/** 台股加權指數（Yahoo：^TWII） */
export async function fetchTaiwanWeightedIndex(): Promise<Omit<QuoteRow, "id" | "label">> {
  try {
    const { quote, sparkline } = await fetchYahooQuoteWithSparkline("^TWII");
    return {
      symbol: "^TWII",
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      sparkline,
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch (e) {
    return {
      symbol: "^TWII",
      price: null,
      changePct: null,
      currency: "TWD",
      sparkline: null,
      source: "Yahoo Finance",
      updatedAt: null,
      status: "error",
      error: e instanceof Error ? e.message : "請求失敗",
    };
  }
}

/** 台股個股：台積電 2330.TW */
export async function fetchTaiwan(): Promise<Omit<QuoteRow, "id" | "label">> {
  try {
    const { quote, sparkline } = await fetchYahooQuoteWithSparkline("2330.TW");
    return {
      symbol: "2330.TW",
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      sparkline,
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch (e) {
    return {
      symbol: "2330.TW",
      price: null,
      changePct: null,
      currency: "TWD",
      sparkline: null,
      source: "Yahoo Finance",
      updatedAt: null,
      status: "error",
      error: e instanceof Error ? e.message : "請求失敗",
    };
  }
}

/** Frankfurter 新版 API：https://api.frankfurter.dev/v2/rate/{base}/{quote} */
async function fetchUsdTwdFromFrankfurter(): Promise<number> {
  const url = `${frankfurterUrl("/v2/rate/USD/TWD")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { rate?: number };
  const rate = json.rate;
  if (rate == null || Number.isNaN(rate)) throw new Error("無匯率資料");
  return rate;
}

/** open.er-api.com 備援（回傳欄位為 rates，舊版文件曾稱 conversion_rates） */
async function fetchUsdTwdFromOpenEr(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: string;
    rates?: { TWD?: number };
    conversion_rates?: { TWD?: number };
  };
  if (json.result !== "success") throw new Error("匯率 API 回應異常");
  const rate = json.rates?.TWD ?? json.conversion_rates?.TWD;
  if (rate == null || Number.isNaN(rate)) throw new Error("無匯率資料");
  return rate;
}

/** 美元兌新台幣（Frankfurter 優先；失敗時改用 open.er-api.com） */
export async function fetchUsdTwd(): Promise<Omit<QuoteRow, "id" | "label">> {
  let source = "Frankfurter";
  try {
    const rate = await fetchUsdTwdFromFrankfurter();
    let sparkline: number[] | null = null;
    try {
      const s = await fetchUsdTwdSparklineRates();
      sparkline = s.length >= 2 ? s : null;
    } catch {
      sparkline = null;
    }
    return {
      symbol: "USD/TWD",
      price: rate,
      changePct: null,
      currency: "TWD",
      unit: "1 USD",
      sparkline,
      source,
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch {
    try {
      source = "Open ER API";
      const rate = await fetchUsdTwdFromOpenEr();
      let sparkline: number[] | null = null;
      try {
        const s = await fetchUsdTwdSparklineRates();
        sparkline = s.length >= 2 ? s : null;
      } catch {
        sparkline = null;
      }
      return {
        symbol: "USD/TWD",
        price: rate,
        changePct: null,
        currency: "TWD",
        unit: "1 USD",
        sparkline,
        source,
        updatedAt: new Date().toISOString(),
        status: "ok",
      };
    } catch (e) {
      return {
        symbol: "USD/TWD",
        price: null,
        changePct: null,
        currency: "TWD",
        sparkline: null,
        source: "Frankfurter / Open ER API",
        updatedAt: null,
        status: "error",
        error: e instanceof Error ? e.message : "請求失敗",
      };
    }
  }
}

/** 黃金期貨 GC=F（美元／盎司） */
export async function fetchGold(): Promise<Omit<QuoteRow, "id" | "label">> {
  try {
    const { quote, sparkline } = await fetchYahooQuoteWithSparkline("GC=F");
    return {
      symbol: "GC=F",
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      sparkline,
      unit: "盎司",
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch (e) {
    return {
      symbol: "GC=F",
      price: null,
      changePct: null,
      currency: "USD",
      sparkline: null,
      unit: "盎司",
      source: "Yahoo Finance",
      updatedAt: null,
      status: "error",
      error: e instanceof Error ? e.message : "請求失敗",
    };
  }
}

/** 比特幣：CoinGecko 公開 API（有速率限制） */
export async function fetchBitcoin(): Promise<Omit<QuoteRow, "id" | "label">> {
  try {
    const [res, sparkVals] = await Promise.all([
      fetch(
        coingeckoUrl(
          "/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
        )
      ),
      fetchBitcoinSparklineUsd().catch(() => [] as number[]),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      bitcoin?: { usd?: number; usd_24h_change?: number };
    };
    const usd = json.bitcoin?.usd;
    if (usd == null) throw new Error("無 BTC 資料");
    const ch = json.bitcoin?.usd_24h_change ?? null;
    const sparkline = sparkVals.length >= 2 ? sparkVals : null;
    return {
      symbol: "BTC",
      price: usd,
      changePct: ch,
      currency: "USD",
      sparkline,
      source: "CoinGecko",
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch (e) {
    // CoinGecko 常見 429 限流：改用 Binance 備援，避免卡片整張失敗
    if (isRateLimitedError(e)) {
      try {
        const b = await fetchBitcoinFromBinance();
        return {
          symbol: "BTC",
          price: b.price,
          changePct: b.changePct,
          currency: "USD",
          sparkline: b.sparkline,
          source: "Binance（CoinGecko 429 備援）",
          updatedAt: new Date().toISOString(),
          status: "ok",
        };
      } catch (e2) {
        return {
          symbol: "BTC",
          price: null,
          changePct: null,
          currency: "USD",
          sparkline: null,
          source: "CoinGecko / Binance",
          updatedAt: null,
          status: "error",
          error: e2 instanceof Error ? e2.message : "請求失敗",
        };
      }
    }
    return {
      symbol: "BTC",
      price: null,
      changePct: null,
      currency: "USD",
      sparkline: null,
      source: "CoinGecko",
      updatedAt: null,
      status: "error",
      error: e instanceof Error ? e.message : "請求失敗",
    };
  }
}

/** WTI 原油 CL=F */
export async function fetchOil(): Promise<Omit<QuoteRow, "id" | "label">> {
  try {
    const { quote, sparkline } = await fetchYahooQuoteWithSparkline("CL=F");
    return {
      symbol: "CL=F",
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      sparkline,
      unit: "桶",
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      status: "ok",
    };
  } catch (e) {
    return {
      symbol: "CL=F",
      price: null,
      changePct: null,
      currency: "USD",
      sparkline: null,
      unit: "桶",
      source: "Yahoo Finance",
      updatedAt: null,
      status: "error",
      error: e instanceof Error ? e.message : "請求失敗",
    };
  }
}

export async function fetchAllQuotes(): Promise<QuoteRow[]> {
  const [twii, tw, usd, gold, btc, oil] = await Promise.all([
    fetchTaiwanWeightedIndex(),
    fetchTaiwan(),
    fetchUsdTwd(),
    fetchGold(),
    fetchBitcoin(),
    fetchOil(),
  ]);

  return [
    { id: "twii", label: "台股加權指數", ...twii },
    { id: "tw", label: "台積電", ...tw },
    { id: "usd", label: "美元／新台幣", ...usd },
    { id: "gold", label: "黃金（期貨 GC）", ...gold },
    { id: "btc", label: "比特幣", ...btc },
    { id: "oil", label: "原油 WTI（CL）", ...oil },
  ];
}
