import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveCarpool from "../components/LiveCarpool";

vi.mock("../lib/maps-loader.mjs", () => ({ loadMapsSdk: ({ onReady }) => { onReady(); return () => {}; } }));
vi.mock("../components/RideConversation", () => ({ default: ({ tripId }) => <div>Conversation for ride {tripId}</div> }));
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const coords = { "Cubbon Park": { lat: 12.976, lng: 77.592 }, "Indiranagar": { lat: 12.972, lng: 77.641 } };
const calls = [];
let bookingRows = [];
beforeEach(() => {
  calls.length = 0; bookingRows = [];
  vi.stubGlobal("google", { maps: {
    importLibrary: async name => name === "maps" ? { Map: class { fitBounds() {} } } : name === "places" ? { AutocompleteSuggestion: { fetchAutocompleteSuggestions: async ({ input }) => ({ suggestions: [{ placePrediction: { placeId: input, text: { text: `${input}, Bengaluru` }, toPlace: () => ({ fetchFields: async () => {}, formattedAddress: `${input}, Bengaluru`, location: { lat: () => coords[input].lat, lng: () => coords[input].lng } }) } }] }) } } : {},
    routes: { Route: { computeRoutes: async () => ({ routes: [{ path: [{ lat: 12.976, lng: 77.592 }, { lat: 12.972, lng: 77.641 }], distanceMeters: 6000, durationMillis: 900000 }] }) } },
    Polyline: class { setMap() {} }, LatLngBounds: class { extend() {} },
  } });
  vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
    const path = String(input); const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, method: init.method || "GET", headers: new Headers(init.headers) });
    if (path.endsWith("/bookings")) return json({ data: bookingRows });
    if (path.endsWith("/notifications")) return json({ data: [] });
    if (path.endsWith("/offers")) return json({ data: [] });
    if (path.endsWith("/profile")) return json({ profile: body });
    if (path.includes("/rides?")) return json({ data: [{ trip_id: 7, driver_name: "Arjun", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar", quote_token: "quote-7", seats_available: 1 }] });
    if (path.endsWith("/rides/7/request")) { bookingRows = [{ booking_id: 9, trip_id: 7, driver_name: "Arjun", request_state: 0, departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" }]; return json({ data: bookingRows[0] }); }
    if (path.endsWith("/bookings/9/accept")) { bookingRows = bookingRows.map(b => ({ ...b, request_state: 1 })); return json({ data: bookingRows[0] }); }
    if (path.endsWith("/trips/7/transition")) {
      bookingRows = bookingRows.map(b => ({ ...b, state: body.action === "start" ? "in_progress" : body.action === "complete" ? "completed" : b.state, participant_state: body.action === "board" ? "boarded" : body.action === "alight" ? "alighted" : b.participant_state }));
      return json({ trip_id: 7, state: bookingRows[0].state });
    }
    throw Error(`Unexpected request ${path}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function choosePlaces() {
  fireEvent.change(screen.getByLabelText("Pickup place"), { target: { value: "Cubbon Park" } });
  fireEvent.click(await screen.findByRole("button", { name: "Cubbon Park, Bengaluru" }));
  fireEvent.change(screen.getByLabelText("Destination place"), { target: { value: "Indiranagar" } });
  fireEvent.click(await screen.findByRole("button", { name: "Indiranagar, Bengaluru" }));
  await screen.findByText(/6.0 km.*15 min driving/);
}
describe("Google place carpool flow", () => {
  it("requires selected Google places instead of accepting unconfirmed text", async () => {
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    fireEvent.click(await screen.findByRole("button", { name: "Find rides" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select your pickup and destination");
    expect(calls.some(call => call.path.endsWith("/profile"))).toBe(false);
  });
  it("searches with selected coordinates and time, requests a real returned ride, and refreshes its pending state", async () => {
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    await choosePlaces();
    fireEvent.change(screen.getByLabelText("Preferred pickup time"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Travel date"), { target: { value: "2026-12-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    fireEvent.click(await screen.findByRole("button", { name: "Request seat" }));
    expect(await screen.findByText("Seat requested. The driver has been notified.")).toBeVisible();
    expect(await screen.findByText("Awaiting driver")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request seat" })).not.toBeInTheDocument();
    const profile = calls.find(call => call.path.endsWith("/profile"));
    expect(profile.body).toMatchObject({ role: "rider", home: { lat: 12.976, lng: 77.592 }, campus: { lat: 12.972, lng: 77.641 }, outbound_time: "10:00" });
    const request = calls.find(call => call.path.endsWith("/rides/7/request"));
    expect(request.body).toEqual({ quote_token: "quote-7" });
    expect(request.headers.get("Authorization")).toBe("Bearer rider-token");
    expect(request.headers.get("Idempotency-Key")).toBeTruthy();
  });
  it("publishes the chosen driver route and accepts a named rider before opening chat", async () => {
    bookingRows = [{ booking_id: 9, trip_id: 7, rider_name: "Gaia", request_state: 0, departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" }];
    render(<LiveCarpool token="driver-token" accountRole="driver" />);
    await choosePlaces();
    fireEvent.click(screen.getByRole("button", { name: "Publish ride" }));
    await screen.findByText("Ride published. Riders can now find it and request a seat.");
    const publish = calls.find(call => call.path.endsWith("/offers") && call.method === "POST");
    expect(publish.body).toMatchObject({ direction: "outbound", vehicle_type: "car", choice: "DIRECT_RIDER_PICKUP" });
    expect(publish.headers.get("Idempotency-Key")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Accept rider" }));
    await screen.findByText("Accepted");
    fireEvent.click(screen.getByRole("button", { name: "Chat & location" }));
    expect(await screen.findByText("Conversation for ride 7")).toBeVisible();
    await waitFor(() => expect(calls.some(call => call.path.endsWith("/bookings/9/accept"))).toBe(true));
  });
  it("starts, boards, drops off and completes a ride while closing live chat at completion", async () => {
    bookingRows = [{ booking_id: 9, trip_id: 7, rider_id: 5, rider_name: "Gaia", request_state: 1, state: "planned", participant_state: "accepted", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" }];
    render(<LiveCarpool token="driver-token" accountRole="driver" />);
    fireEvent.click(await screen.findByRole("button", { name: "Chat & location" }));
    expect(await screen.findByText("Conversation for ride 7")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Start ride" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark rider picked up" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark rider dropped off" }));
    fireEvent.click(await screen.findByRole("button", { name: "Complete ride" }));
    expect(await screen.findByText("Ride completed")).toBeVisible();
    expect(screen.queryByText("Conversation for ride 7")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chat & location" })).not.toBeInTheDocument();
    const transitions = calls.filter(c => c.path.endsWith("/trips/7/transition"));
    expect(transitions.map(c => c.body)).toEqual([{ action: "start" }, { action: "board", passenger_id: 5 }, { action: "alight", passenger_id: 5 }, { action: "complete" }]);
    expect(transitions.every(c => Boolean(c.headers.get("Idempotency-Key")))).toBe(true);
  });
});

it.each([[2, "Declined", "in_progress"], [3, "Cancelled", "in_progress"], [2, "Declined", "completed"], [3, "Cancelled", "completed"]])("preserves request state %s (%s) when another rider trip is %s", async (requestState, expectedLabel, tripState) => {
  bookingRows = [{ booking_id: 9, trip_id: 7, driver_name: "Arjun", request_state: requestState, state: tripState, participant_state: "accepted", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" }];
  render(<LiveCarpool token="rider-token" accountRole="rider" />);
  await screen.findByText("Ride #7", { exact: false });
  expect(screen.getByText(expectedLabel, { exact: true })).toBeVisible();
});
