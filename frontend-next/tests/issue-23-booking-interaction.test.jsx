import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "../app/page";

const profile = {
  role: "rider",
  home: { lat: 12.9716, lng: 77.5946, label: "Home" },
  campus: { lat: 12.9352, lng: 77.62, label: "Campus" },
  outbound_time: "08:30",
  return_time: "17:30",
  max_walk_meters: 500,
  weekdays: [1, 2, 3, 4, 5],
};

const ride = {
  trip_id: 42,
  departure_at: "2026-10-28T03:00:00.000Z",
  duration_minutes: 32,
  driver_name: "Asha",
  vehicle_type: "car",
  pickup_label: "Home pickup",
  dropoff_label: "Campus gate",
  choice: "DIRECT_RIDER_PICKUP",
  access_meters: 84,
  egress_meters: 41,
  base_fare_minor: 1200,
  surcharge_minor: 300,
  total_fare_minor: 1500,
  quote_token: "quote-42",
  route_map: { driver_geometry: [[77.5946, 12.9716], [77.62, 12.9352]] },
};

let calls;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

function installApi() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body, key: new Headers(init.headers).get("Idempotency-Key") });
    if (url === "/api/mobility/commute/demo-session" && method === "POST") return json({ token: "rider-token" });
    if (url === "/api/mobility/commute/me") return json({ profile, operator: false });
    if (url === "/api/mobility/commute/bookings") return json({ data: [] });
    if (url === "/api/mobility/commute/waitlist") return json({ data: [] });
    if (url === "/api/mobility/commute/wallet") return json({ balance_minor: 2500 });
    if (url === "/mobility-pilot/maps-config") return json({});
    if (url.includes("/api/mobility/commute/rides?") && method === "GET") return json({ data: [ride] });
    if (url === "/api/mobility/commute/rides/42/request" && method === "POST") {
      return json({ booking: { id: 7, request_state: 0 } });
    }
    throw new Error(`Unhandled mocked request: ${method} ${url}`);
  }));
}

async function openRide() {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: /Find a ride/i }));
  await screen.findByRole("heading", { name: "Choose your route." });
  await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Search rides" }));
  await screen.findByRole("heading", { name: "Available rides." });
}

beforeEach(() => {
  installApi();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("issue 23 booking acceptance journey", () => {
  it("mounts the rider flow, enforces fare consent, and submits the server quote", async () => {
    await openRide();

    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(await screen.findByText("Agree to the fare before requesting this ride.")).toBeInTheDocument();
    expect(calls.filter(({ url, method }) => url.endsWith("/42/request") && method === "POST")).toHaveLength(0);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => (
      url.endsWith("/42/request") && method === "POST" && body.quote_token === "quote-42"
    ))).toBe(true));
    expect(await screen.findByRole("status")).toHaveTextContent("Ride request sent");
    expect(screen.getByRole("heading", { name: "Booking activity." })).toBeInTheDocument();
  });
});
