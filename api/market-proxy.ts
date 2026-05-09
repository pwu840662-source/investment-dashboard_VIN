import type { VercelRequest, VercelResponse } from "@vercel/node";

type Target = "yahoo" | "frankfurter" | "coingecko";

const TARGETS: Record<Target, string> = {
  yahoo: "https://query1.finance.yahoo.com",
  frankfurter: "https://api.frankfurter.dev",
  coingecko: "https://api.coingecko.com",
};

function isSafeUpstreamPath(p: string): boolean {
  if (!p || p.length > 2048) return false;
  if (/\.\.|:\/\//.test(p)) return false;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const url = new URL(req.url ?? "/", "https://x");
  const t = url.searchParams.get("t") as Target;
  const p = url.searchParams.get("p");
  if (!t || !p || !(t in TARGETS)) {
    res.status(400).json({ error: "Bad target or path" });
    return;
  }
  if (!isSafeUpstreamPath(p)) {
    res.status(400).json({ error: "Bad path" });
    return;
  }

  url.searchParams.delete("t");
  url.searchParams.delete("p");
  const upstreamQs = url.searchParams.toString();
  const encodedPath = p
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const upstreamUrl = `${TARGETS[t]}/${encodedPath}${upstreamQs ? `?${upstreamQs}` : ""}`;

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      "user-agent": req.headers["user-agent"] ?? "investment-dashboard-proxy",
      accept: req.headers.accept ?? "application/json,text/plain,*/*",
    },
  });

  res.status(upstream.status);
  res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
  res.setHeader("cache-control", "no-store");

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
