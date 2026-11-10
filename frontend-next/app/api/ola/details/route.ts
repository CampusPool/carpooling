import type { NextRequest } from "next/server";
import { authorizedKey, olaProviderRequest, proxyFailure, validatedOlaPlaceId } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const placeId = request.nextUrl.searchParams.get("place_id") || "";
    if (!validatedOlaPlaceId(placeId)) return Response.json({ error: { code: "INVALID_PLACE_ID" } }, { status: 400 });
    const key = await authorizedKey(request, "details");
    const body = await olaProviderRequest("/places/v1/details", { place_id: placeId }, key);
    const result = body.result;
    const location = result?.geometry?.location;
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return Response.json({ error: { code: "PLACE_LOCATION_MISSING" } }, { status: 502 });
    }
    return Response.json({ place: {
      label: String(result.formatted_address || result.name || "Location").slice(0, 160),
      lat: location.lat, lng: location.lng,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return proxyFailure(error); }
}
