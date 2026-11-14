import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "../app/api/ola/static-map/route";
const key = "server-key-synthetic-123456789";
const points = [{ lat: 12.9718, lng: 77.6412 }, { lat: 12.9345, lng: 77.5348 }];
function req(body, auth = "Bearer synthetic-session-12345678") { return new Request("http://localhost/api/ola/static-map", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.stubEnv("OLA_MAPS_ENABLED", "1"); vi.stubEnv("OLA_MAPS_API_KEY", key); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("returns a private image without revealing the server key", async () => {
  vi.stubGlobal("fetch", vi.fn(async url => String(url).startsWith("http://127.0.0.1")
    ? new Response("{}", { status: 200 }) : new Response(new Uint8Array([137,80,78,71]), { status: 200, headers: { "content-type": "image/png" } })));
  const result = await POST(req({ points }));
  expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toContain("no-store");
  expect(result.headers.get("content-type")).toBe("image/png"); expect(await result.text()).not.toContain(key);
});
it("rejects unauthenticated and malformed coordinates", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  expect((await POST(req({ points }, ""))).status).toBe(401);
  expect((await POST(req({ points: [{lat: 999, lng: 0}, points[1]] }))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
