import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const PROVIDER = "https://api.olamaps.io";
const MAX_BYTES = 1_500_000;
const events = new Map<string, { start: number; count: number }>();

export class OlaProxyError extends Error {
  constructor(public readonly status: number, public readonly publicCode: string) {
    super(publicCode);
  }
}

/** Fail closed unless explicitly enabled; validate the application JWT before spending API quota. */
export async function authorizedKey(request: NextRequest, operation: string): Promise<string> {
  if (process.env.OLA_MAPS_ENABLED !== "1") throw new OlaProxyError(503, "OLA_NOT_ENABLED");
  const key = process.env.OLA_MAPS_API_KEY || "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new OlaProxyError(503, "OLA_NOT_CONFIGURED");
  const auth = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]{16,4096}$/.test(auth)) throw new OlaProxyError(401, "ACCOUNT_REQUIRED");
  const origin = process.env.MOBILITY_API_ORIGIN || "http://127.0.0.1:18080";
  // The backend origin must be an explicit trusted configuration, not a user-provided URL.
  const parsed = new URL(origin);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new OlaProxyError(503, "BACKEND_MISCONFIGURED");
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(new URL("/api/mobility/commute/me", origin), {
        method: "GET", headers: { authorization: auth, accept: "application/json" },
        cache: "no-store", redirect: "manual", signal: controller.signal,
      });
      if (!response.ok) throw new OlaProxyError(response.status === 401 ? 401 : 403, "ACCOUNT_UNVERIFIED");
    } finally { clearTimeout(timeout); }
  } catch (error) {
    if (error instanceof OlaProxyError) throw error;
    throw new OlaProxyError(503, "BACKEND_UNAVAILABLE");
  }
  const stamp = Date.now();
  const hash = createHash("sha256").update(auth).digest("hex").slice(0, 24) + ":" + operation;
  const old = events.get(hash);
  const entry = old && stamp - old.start < 60_000 ? old : { start: stamp, count: 0 };
  const limit = operation === "autocomplete" ? 12 : operation === "directions" ? 8 : 20;
  if (entry.count >= limit) throw new OlaProxyError(429, "OLA_LOCAL_RATE_LIMIT");
  entry.count++;
  if (events.size > 500) {
    for (const [id, state] of events) if (stamp - state.start >= 60_000) events.delete(id);
  }
  events.set(hash, entry);
  return key;
}

/** Every provider URL is constructed from a fixed host and known API path; never reflect raw API keys. */
export async function olaProviderRequest(path: string, params: Record<string, string>, key: string, method: "GET" | "POST" = "GET") {
  const url = new URL(path, PROVIDER);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("api_key", key);
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      response = await fetch(url, {
        method, headers: { accept: "application/json", "X-Request-Id": crypto.randomUUID() },
        cache: "no-store", redirect: "manual", signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }
  } catch { throw new OlaProxyError(503, "OLA_UNAVAILABLE"); }
  if (response.status === 429) throw new OlaProxyError(429, "OLA_QUOTA_OR_RATE_LIMIT");
  if (!response.ok) throw new OlaProxyError(502, "OLA_PROVIDER_ERROR");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new OlaProxyError(502, "OLA_RESPONSE_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new OlaProxyError(502, "OLA_RESPONSE_INVALID"); }
}

export function proxyFailure(error: unknown): Response {
  if (error instanceof OlaProxyError) return Response.json({ error: { code: error.publicCode } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ error: { code: "OLA_UNAVAILABLE" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export function validatedCoordinates(value: unknown): value is { lat: number; lng: number } {
  return !!value && typeof value === "object" && "lat" in value && "lng" in value
    && typeof value.lat === "number" && Number.isFinite(value.lat) && value.lat >= 12.65 && value.lat <= 13.35
    && typeof value.lng === "number" && Number.isFinite(value.lng) && value.lng >= 77.2 && value.lng <= 77.95;
}
