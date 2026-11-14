import type { NextRequest } from "next/server";
import { authorizedKey, OlaProxyError, proxyFailure, validatedCoordinates } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 20000) throw new OlaProxyError(413, "MAP_REQUEST_TOO_LARGE");
    const reader = request.body?.getReader();
    if (!reader) throw new OlaProxyError(400, "INVALID_MAP_POINTS");
    const decoder = new TextDecoder(); let text = "", bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 20000) { await reader.cancel(); throw new OlaProxyError(413, "MAP_REQUEST_TOO_LARGE"); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    let payload: any;
    try { payload = JSON.parse(text); } catch { throw new OlaProxyError(400, "INVALID_MAP_POINTS"); }
    const points = payload?.points;
    if (!Array.isArray(points) || points.length < 2 || points.length > 100 || !points.every(validatedCoordinates)) {
      throw new OlaProxyError(400, "INVALID_MAP_POINTS");
    }
    const key = await authorizedKey(request, "static-map");
    const url = new URL("https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/auto/800x400.png");
    const path = points.map((p: {lat: number; lng: number}) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join("|");
    url.searchParams.set("path", `${path}|width:5|stroke:#176b5b`);
    url.searchParams.set("api_key", key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const upstream = await fetch(url, { signal: controller.signal, redirect: "error", headers: { accept: "image/png" } });
      if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/png")) throw new OlaProxyError(502, "MAP_UNAVAILABLE");
      const body = await upstream.arrayBuffer();
      if (body.byteLength > 2_000_000) throw new OlaProxyError(502, "MAP_RESPONSE_TOO_LARGE");
      return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    } finally { clearTimeout(timer); }
  } catch (error) { return proxyFailure(error); }
}
