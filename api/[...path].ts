import type { VercelRequest, VercelResponse } from "@vercel/node";

type Target = "yahoo" | "frankfurter" | "coingecko";

const TARGETS: Record<Target, string> = {
  yahoo: "https://query1.finance.yahoo.com",
  frankfurter: "https://api.frankfurter.dev",
  coingecko: "https://api.coingecko.com",
};

function getPathParts(req: VercelRequest): string[] {
  const raw = req.query.path;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return raw.split("/").filter(Boolean);
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const parts = getPathParts(req);
  const targetKey = (parts.shift() ?? "") as Target;
  if (!targetKey || !(targetKey in TARGETS)) {
    res.status(400).json({ error: "Bad target" });
    return;
  }

  const upstreamPath = `/${parts.join("/")}`;
  const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const upstreamUrl = `${TARGETS[targetKey]}${upstreamPath}${qs}`;

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
