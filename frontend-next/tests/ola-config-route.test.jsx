import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "../app/api/ola/config/route";
const serverKey = "server-key-synthetic-123456789";
const browserKey = "browser-key-synthetic-12345678";
function request() { return new Request("http://localhost/api/ola/config", { headers: { authorization: "Bearer synthetic-session-123456789" } }); }
beforeEach(() => {
  vi.stubEnv("OLA_MAPS_ENABLED", "1"); vi.stubEnv("OLA_MAPS_API_KEY", serverKey);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("never returns the server credential when the browser key is missing or identical", async () => {
  for (const value of ["", serverKey]) {
    vi.stubEnv("OLA_MAPS_BROWSER_KEY", value);
    const result = await GET(request());
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain(serverKey);
  }
});
it("returns a separate configured browser key to an authenticated session", async () => {
  vi.stubEnv("OLA_MAPS_BROWSER_KEY", browserKey);
  const result = await GET(request());
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ provider: "ola", browserKey });
});
