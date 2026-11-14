import type { NextRequest } from "next/server";
import { authorizedKey, proxyFailure, OlaProxyError } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const key = await authorizedKey(request, "config");
    // The Web SDK requires a browser key. Restrict its provider-side referrers;
    // this endpoint requires a valid local CampusPool session, but the key is
    // necessarily visible to that browser and must not be treated as a secret.
    const browserKey = process.env.OLA_MAPS_BROWSER_KEY || "";
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(browserKey) || browserKey === key) throw new OlaProxyError(503, "OLA_BROWSER_KEY_NOT_CONFIGURED");
    return Response.json({ provider: "ola", browserKey }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return proxyFailure(error); }
}
