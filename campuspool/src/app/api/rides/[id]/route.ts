import { api, id, json, requireUser } from "@/server/core";
import { getRide } from "@/server/search";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async () => json(await getRide(await requireUser(request, true), id((await context.params).id))));
}
