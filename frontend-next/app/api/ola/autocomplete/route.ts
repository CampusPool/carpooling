import type { NextRequest } from "next/server";
import { authorizedKey, olaProviderRequest, proxyFailure } from "../../../../lib/ola-server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("input")?.trim() || "";
    if (input.length < 3 || input.length > 100 || /[\x00-\x1f]/.test(input)) return Response.json({ error: { code: "INVALID_PLACE_QUERY" } }, { status: 400 });
    const key = await authorizedKey(request, "autocomplete");
    const result = await olaProviderRequest("/places/v1/autocomplete", { input, location: "12.9716,77.5946" }, key);
    const predictions = Array.isArray(result.predictions) ? result.predictions.slice(0, 5).map((place: Record<string, unknown>) => ({
      placeId: typeof place.place_id === "string" ? place.place_id : "",
      description: typeof place.description === "string" ? place.description.slice(0, 200) : "",
    })).filter((place: { placeId: string; description: string }) => place.placeId && place.description) : [];
    return Response.json({ predictions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return proxyFailure(error); }
}
