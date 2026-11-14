import type { NextRequest } from "next/server";
import { authorizedKey, olaProviderRequest, proxyFailure, validatedCoordinates } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const points = payload?.points;
    const mode = payload?.mode || "driving";
    if (!Array.isArray(points) || points.length < 2 || points.length > 8 || !points.every(validatedCoordinates)
        || !["driving", "walking", "bike"].includes(mode)) {
      return Response.json({ error: { code: "INVALID_ROUTE_POINTS" } }, { status: 400 });
    }
    const key = await authorizedKey(request, "directions");
    const format = (point: { lat: number; lng: number }) => `${point.lat},${point.lng}`;
    const params: Record<string, string> = { origin: format(points[0]), destination: format(points[points.length - 1]), mode, overview: "full", steps: "false", alternatives: "false" };
    if (points.length > 2) params.waypoints = points.slice(1, -1).map(format).join("|");
    const result = await olaProviderRequest("/routing/v1/directions", params, key, "POST");
    const route = result.routes?.[0];
    if (result.status !== "SUCCESS" || !route || !Array.isArray(route.legs) || !route.legs.length
      || typeof route.overview_polyline !== "string" || route.overview_polyline.length > 300000) {
      return Response.json({ error: { code: "ROUTE_UNAVAILABLE" } }, { status: 502 });
    }
    const distance = route.legs.reduce((sum: number, leg: { distance: unknown }) => sum + Number(leg.distance), 0);
    const duration = route.legs.reduce((sum: number, leg: { duration: unknown }) => sum + Number(leg.duration), 0);
    if (!Number.isFinite(distance) || distance <= 0 || distance > 100000 || !Number.isFinite(duration) || duration <= 0 || duration > 86400) {
      return Response.json({ error: { code: "ROUTE_INVALID" } }, { status: 502 });
    }
    return Response.json({ distanceMeters: Math.ceil(distance), durationSeconds: Math.ceil(duration), encodedPolyline: route.overview_polyline }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return proxyFailure(error); }
}
