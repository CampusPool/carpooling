import { api, HttpError, json, requireUser } from "@/server/core";
import { searchQuery, searchRides } from "@/server/search";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(request, async () => {
    const user = await requireUser(request, true);
    const parsed = searchQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new HttpError(400, "INVALID_SEARCH", "Invalid ride search parameters");
    return json(await searchRides(user, parsed.data));
  });
}
