import { api, body, json, key, requireUser } from "@/server/core";
import { createVehicle, listVehicles, vehicleInput } from "@/server/vehicles";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(request, async () => json(await listVehicles(await requireUser(request, true))));
}
export async function POST(request: Request) {
  return api(request, async () => json(await createVehicle(await requireUser(request, true), await body(request, vehicleInput), key(request)), 201));
}
