import { api, body, id, json, key, requireUser } from "@/server/core";
import { reviewInput, reviewVehicle } from "@/server/vehicles";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => json(await reviewVehicle(await requireUser(request, true), id((await context.params).id), await body(request, reviewInput), key(request))));
}
