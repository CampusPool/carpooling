import { api, body, json, key, requireUser } from "@/server/core";
import { listOffers, offerInput, publishOffer } from "@/server/offers";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(request, async () => json(await listOffers(await requireUser(request, true))));
}
export async function POST(request: Request) {
  return api(request, async () => json(await publishOffer(await requireUser(request, true), await body(request, offerInput), key(request)), 201));
}
