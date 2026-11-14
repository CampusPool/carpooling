import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AddressRides from "../components/AddressRides";
import RideRating from "../components/RideRating";

vi.mock("../lib/maps-loader.mjs", () => ({ loadMapsSdk: ({ onReady }) => { onReady(); return () => {}; } }));
vi.mock("../components/CanonicalRouteMap", () => ({ default: () => null }));
vi.mock("../components/RideConversation", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("lets a participant submit one rating with a stable idempotency key and renders the saved result", async () => {
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push([String(url), options]);
    return new Response(JSON.stringify(options.method === "POST" ? { data: { rating: 4 } } : { data: [] }), { status: 200 });
  }));
  render(<RideRating token="student-token" tripId={17} counterpartId={22} counterpartName="Riya" />);
  fireEvent.click(await screen.findByRole("button", { name: "4 stars" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Optional note" }), { target: { value: "A smooth trip" } });
  fireEvent.click(screen.getByRole("button", { name: "Send rating" }));
  expect(await screen.findByText(/Thanks for rating Riya/)).toBeVisible();
  const [, request] = requests.find(([url, init]) => url.endsWith("/17/ratings") && init.method === "POST");
  expect(JSON.parse(request.body)).toEqual({ ratee_id: 22, rating: 4, comment: "A smooth trip" });
  expect(request.headers["Idempotency-Key"]).toBeTruthy();
  expect(request.headers.Authorization).toBe("Bearer student-token");
  expect(screen.queryByRole("button", { name: "Send rating" })).not.toBeInTheDocument();
});

it("shows a previous rating only for the appropriate counterpart", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
    { direction: "authored", counterpart_id: 23, rating: 2 },
    { direction: "authored", counterpart_id: 22, rating: 5 },
  ] }), { status: 200 })));
  render(<RideRating token="student-token" tripId={17} counterpartId={22} counterpartName="Riya" />);
  expect(await screen.findByLabelText("5 out of 5 stars")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Send rating" })).not.toBeInTheDocument();
});

it("exposes rating only on accepted completed bookings and targets the other participant", async () => {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    calls.push([String(url), options]);
    const path = String(url);
    const body = path.endsWith("/bookings") ? { data: [
      { booking_id: 1, trip_id: 17, owner: true, rider_id: 22, rider_name: "Riya", driver_id: 10, driver_name: "Driver", request_state: 1, state: "completed", departure_at: "2026-11-14T08:30:00+05:30" },
      { booking_id: 2, trip_id: 18, owner: false, rider_id: 10, driver_id: 24, driver_name: "Sam", request_state: 1, state: "planned", departure_at: "2026-11-15T08:30:00+05:30" },
      { booking_id: 3, trip_id: 19, owner: false, rider_id: 10, driver_id: 25, driver_name: "Lee", request_state: 3, state: "completed", departure_at: "2026-11-14T08:30:00+05:30" },
    ] } : { data: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  render(<AddressRides token="student-token" initialMode="bookings" />);
  expect(await screen.findByRole("region", { name: "Rate Riya" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Rate Sam" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Rate Lee" })).not.toBeInTheDocument();
  expect(calls.some(([url]) => url === "/api/mobility/trips/17/ratings")).toBe(true);
  expect(calls.some(([url]) => url === "/api/mobility/trips/18/ratings" || url === "/api/mobility/trips/19/ratings")).toBe(false);
});
