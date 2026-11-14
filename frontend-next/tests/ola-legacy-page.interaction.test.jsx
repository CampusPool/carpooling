import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Page from "../app/page";

vi.mock("../components/OlaMapPanel", () => ({
  default: () => <div aria-label="Ola route preview">Ola map component</div>,
}));

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MAP_PROVIDER", "ola");
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("uses only same-origin Ola Places in the legacy account UI, not Google SDK", async () => {
  const calls = [];
  vi.stubGlobal("google", { maps: { importLibrary: vi.fn(() => { throw Error("Google should not run in Ola mode"); }) } });
  vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
    const url = String(input); calls.push({ url, headers: init.headers });
    if (url === "/api/mobility/local-auth/config") return json({ enabled: true });
    if (url === "/api/mobility/local-auth/register") return json({ token: "synthetic-token", role: "rider", user: { id: 2, name: "rider_test" } }, 201);
    if (url === "/api/mobility/commute/me") return json({ profile: { role: "rider", home: { lat: 12.97, lng: 77.59, label: "Home" }, campus: { lat: 12.935, lng: 77.62, label: "Campus" } } });
    if (url === "/api/mobility/commute/bookings") return json({ data: [] });
    if (url === "/api/mobility/commute/waitlist") return json({ data: [] });
    if (url === "/api/mobility/commute/wallet") return json({ balance_minor: 2500 });
    if (url === "/api/mobility/commute/notifications") return json({ data: [] });
    if (url.startsWith("/api/ola/autocomplete?")) return json({ predictions: [{ placeId: "ola-platform:12345", description: "PES University Bengaluru" }] });
    if (url.startsWith("/api/ola/details?")) return json({ place: { lat: 12.9352, lng: 77.5347, label: "PES University, Bengaluru" } });
    throw Error("Unexpected endpoint: " + url);
  }));
  render(<Page />);
  await screen.findByRole("heading", { name: "Local demo account" });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "rider_test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rider-pass-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  const origin = await screen.findByDisplayValue("Home");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fireEvent.change(origin, { target: { value: "PES University" } });
  fireEvent.click(await screen.findByRole("button", { name: "PES University Bengaluru" }));
  await waitFor(() => expect(screen.getByDisplayValue("PES University, Bengaluru")).toBeInTheDocument());
  expect(calls.filter((call) => call.url.startsWith("/api/ola/"))).toHaveLength(2);
  expect(calls.filter((call) => call.url.includes("googleapis") || call.url.includes("maps-config"))).toHaveLength(0);
  expect(calls.find((call) => call.url.startsWith("/api/ola/details?")).headers.authorization).toBe("Bearer synthetic-token");
  expect(google.maps.importLibrary).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Ola route preview")).toBeInTheDocument();
});
