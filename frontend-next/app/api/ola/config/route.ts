import type { NextRequest } from "next/server";
import { authorizedKey, proxyFailure } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const key = await authorizedKey(request, "config");
    // The Web SDK requires a browser key. Restrict its provider-side referrers;
    // this endpoint requires a valid local CampusPool session, but the key is
    // necessarily visible to that browser and must not be treated as a secret.
    return Response.json({ provider: "ola", browserKey: process.env.OLA_MAPS_BROWSER_KEY || key }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return proxyFailure(error); }
}
