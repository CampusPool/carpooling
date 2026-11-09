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
let rideSearchResponse;
let waitlistRows = [];
let mapClick;
beforeEach(() => {
  calls.length = 0; bookingRows = []; waitlistRows = []; rideSearchResponse = undefined; mapClick = undefined;
  vi.stubGlobal("google", { maps: {
    importLibrary: async name => name === "maps" ? { Map: class { fitBounds() {} addListener(name, fn) { if (name === "click") mapClick = fn; } } } : name === "places" ? { AutocompleteSuggestion: { fetchAutocompleteSuggestions: async ({ input }) => ({ suggestions: [{ placePrediction: { placeId: input, text: { text: `${input}, Bengaluru` }, toPlace: () => ({ fetchFields: async () => {}, formattedAddress: `${input}, Bengaluru`, location: { lat: () => coords[input].lat, lng: () => coords[input].lng } }) } }] }) } } : {},
    routes: { Route: { computeRoutes: async () => ({ routes: [{ path: [{ lat: 12.976, lng: 77.592 }, { lat: 12.972, lng: 77.641 }], distanceMeters: 6000, durationMillis: 900000 }] }) } },
    Polyline: class { setMap() {} }, LatLngBounds: class { extend() {} },
  } });
  vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
    const path = String(input); const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, method: init.method || "GET", headers: new Headers(init.headers) });
    if (path.endsWith("/bookings")) return json({ data: bookingRows });
    if (path.endsWith("/notifications")) return json({ data: [] });
    if (path.endsWith("/wallet")) return json({ available_minor: 0, held_minor: 0, pending_release_minor: 0, entries: [] });
    if (path.endsWith("/waitlist") && (init.method || "GET") === "GET") return json({ data: waitlistRows });
    if (path.endsWith("/rides/7/waitlist")) { waitlistRows = [{ id: 51, trip_id: 7, status: "pending", actionable: false }]; return json({ data: waitlistRows[0] }); }
    if (path.endsWith("/offers")) return json({ data: [] });
    if (path.endsWith("/profile")) return json({ profile: body });
    if (path.includes("/rides?")) return json(rideSearchResponse ?? { data: [{ trip_id: 7, driver_name: "Arjun", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar", quote_token: "quote-7", seats_available: 1 }] });
    if (path.endsWith("/rides/7/request")) { bookingRows = [{ booking_id: 9, trip_id: 7, driver_name: "Arjun", request_state: 0, departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" }]; return json({ data: bookingRows[0] }); }
    if (path.endsWith("/bookings/9/accept")) { bookingRows = bookingRows.map(b => ({ ...b, request_state: 1 })); return json({ data: bookingRows[0] }); }
    if (path.endsWith("/bookings/9/pay")) { bookingRows = bookingRows.map(b => ({ ...b, wallet_state: "held" })); return json({ data: bookingRows[0] }); }
    if (path.endsWith("/bookings/9/confirm-arrival")) { bookingRows = bookingRows.map(b => ({ ...b, rider_arrived_at: "2026-12-05T13:00:00Z", release_at: "2026-12-05T16:00:00Z" })); return json({ data: bookingRows[0] }); }
    if (path.endsWith("/wallet/release-due")) return json({ available_minor: 0 });
    if (path.endsWith("/bookings/9/confirm-payment-received")) { bookingRows = bookingRows.map(b => ({ ...b, receipt: { receipt_number: "DEMO-7-9-SYNTHETIC", non_redeemable: true } })); return json({ data: bookingRows[0] }); }
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
describe("saved route recovery in the unified ride planner", () => {
  const savedProfile = {
    home: { lat: 12.976, lng: 77.592, label: "Cubbon Park" },
    campus: { lat: 12.972, lng: 77.641, label: "Indiranagar" },
    outbound_time: "10:30",
  };
  it("restores the authenticated account's saved places and time without another Places selection", async () => {
    render(<LiveCarpool token="rider-token" accountRole="rider" savedProfile={savedProfile} />);
    expect(screen.getByLabelText("Pickup place")).toHaveValue("Cubbon Park");
    expect(screen.getByLabelText("Destination place")).toHaveValue("Indiranagar");
    expect(screen.getByLabelText("Preferred pickup time")).toHaveValue("10:30");
    expect(await screen.findByText(/6.0 km.*15 min driving/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    await waitFor(() => expect(calls.some(c => c.path.includes("/rides?"))).toBe(true));
    const profileCall = calls.find(c => c.path.endsWith("/profile") && c.method === "PUT");
    expect(profileCall.body.home.label).toBe("Cubbon Park");
    expect(profileCall.body.campus.label).toBe("Indiranagar");
  });
  it("does not trust malformed or out-of-area server saved places", async () => {
    render(<LiveCarpool token="rider-token" accountRole="rider" savedProfile={{
      home: { lat: 99, lng: 77.592, label: "Invalid" },
      campus: { lat: 12.972, lng: 77.641, label: "Indiranagar" },
      outbound_time: "99:99",
    }} />);
    expect(screen.getByLabelText("Pickup place")).toHaveValue("");
    expect(screen.getByLabelText("Destination place")).toHaveValue("Indiranagar");
    expect(screen.getByLabelText("Preferred pickup time")).not.toHaveValue("99:99");
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select your pickup and destination");
    expect(calls.some(c => c.path.endsWith("/profile") && c.method === "PUT")).toBe(false);
  });
});

describe("departure validity in the unified ride planner", () => {
  it("blocks expired departures before updating the profile or publishing", async () => {
    render(<LiveCarpool token="driver-token" accountRole="driver" savedProfile={{
      home: { lat: 12.976, lng: 77.592, label: "Cubbon Park" },
      campus: { lat: 12.972, lng: 77.641, label: "Indiranagar" },
      outbound_time: "10:00",
    }} />);
    fireEvent.change(screen.getByLabelText("Travel date"), { target: { value: "2020-01-01" } });
    fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form"));
    expect(await screen.findByText(/Choose a future departure at least 15 minutes/)).toBeVisible();
    expect(calls.some(c => c.path.endsWith("/profile") && c.method === "PUT")).toBe(false);
    expect(calls.some(c => c.path.endsWith("/offers") && c.method === "POST")).toBe(false);
  });
});

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
  it("explains when driver rides exist but the real route fails walking or detour limits", async () => {
    rideSearchResponse = { data: [], excluded: [{ trip_id: 7, reason: "NO_COMPATIBLE_JOURNEY_WITHIN_LIMITS" }] };
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    await choosePlaces();
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    expect(await screen.findByText(/driver rides were found, but their road route, walking distance or detour limits/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request seat" })).not.toBeInTheDocument();
  });
  it("reports an off-road map selection as an incompatible candidate rather than a server error", async () => {
    rideSearchResponse = { data: [], excluded: [{ trip_id: 7, reason: "ROUTE_INVALID" }] };
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    await choosePlaces();
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    expect(await screen.findByText(/Try a nearby road-accessible pickup point/)).toBeVisible();
    expect(screen.queryByText("Server Error")).not.toBeInTheDocument();
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


describe("full-ride waitlist parity in the unified planner", () => {
  it("offers a waitlist action for a full compatible ride without attempting a seat booking", async () => {
    rideSearchResponse = { data: [{ trip_id: 7, driver_name: "Arjun", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar", quote_token: "full-ride-token", seats_available: 0, waitlist_available: true }] };
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    await choosePlaces();
    fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
    const join = await screen.findByRole("button", { name: "Join waitlist" });
    expect(screen.getByRole("button", { name: "Request seat" })).toBeDisabled();
    fireEvent.click(join);
    expect(await screen.findByText(/Joined the waitlist/)).toBeInTheDocument();
    await waitFor(() => expect(calls.some(call => call.path.endsWith("/rides/7/waitlist") && call.body.quote_token === "full-ride-token" && call.headers.get("Idempotency-Key"))).toBe(true));
    expect(calls.some(call => call.path.endsWith("/rides/7/request"))).toBe(false);
    expect(await screen.findByText(/Seat waitlist · 1 active/)).toBeInTheDocument();
  });
});


describe("demo payment and arrival parity in the map-backed booking panel", () => {
  const trip = { booking_id: 9, trip_id: 7, driver_name: "Driver", rider_name: "Rider", request_state: 1, state: "planned", participant_state: "accepted", fare_minor: 1900, wallet_state: "unpaid", departure_at: "2026-12-05T10:00:00+05:30", pickup_label: "Cubbon Park", dropoff_label: "Indiranagar" };
  it("lets an accepted rider explicitly hold synthetic credits while displaying fare and refreshed payment state", async () => {
    bookingRows = [{ ...trip }];
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    const pay = await screen.findByRole("button", { name: "Confirm demo payment" });
    expect(screen.getByText(/Demo fare ₹19.00 · Payment awaiting confirmation/)).toBeVisible();
    fireEvent.click(pay);
    expect(await screen.findByText(/Demo credits held for this booking/)).toBeVisible();
    expect(await screen.findByText(/Demo fare ₹19.00 · Demo credits held/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm demo payment" })).not.toBeInTheDocument();
    const request = calls.find(c => c.path.endsWith("/bookings/9/pay"));
    expect(request.body).toEqual({});
    expect(request.headers.get("Idempotency-Key")).toBeTruthy();
    expect(request.headers.get("Authorization")).toBe("Bearer rider-token");
  });
  it("lets a rider confirm arrival only after completed paid trip", async () => {
    bookingRows = [{ ...trip, state: "completed", wallet_state: "held", rider_arrived_at: null }];
    render(<LiveCarpool token="rider-token" accountRole="rider" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm arrival" }));
    expect(await screen.findByText(/Arrival confirmed. Demo credit release follows/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm arrival" })).not.toBeInTheDocument();
    expect(calls.filter(c => c.path.endsWith("/bookings/9/confirm-arrival"))).toHaveLength(1);
  });
  it("lets a driver check pending release and records only an eligible synthetic receipt", async () => {
    bookingRows = [{ ...trip, state: "completed", wallet_state: "held", release_at: "2026-12-05T16:00:00Z" }];
    const { rerender } = render(<LiveCarpool token="driver-token" accountRole="driver" />);
    fireEvent.click(await screen.findByRole("button", { name: "Check credit release" }));
    expect(await screen.findByText("Checked pending demo credit releases.")).toBeVisible();
    expect(calls.some(c => c.path.endsWith("/wallet/release-due"))).toBe(true);
    // The server controls the release delay. Never claim a receipt while held.
    expect(screen.queryByRole("button", { name: "Confirm demo payment received" })).not.toBeInTheDocument();
    bookingRows = [{ ...trip, state: "completed", wallet_state: "released" }];
    cleanup();
    render(<LiveCarpool token="driver-token" accountRole="driver" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm demo payment received" }));
    expect(await screen.findByText(/Synthetic receipt recorded/)).toBeVisible();
    expect(await screen.findByText(/Demo receipt DEMO-7-9-SYNTHETIC/)).toBeVisible();
    expect(calls.filter(c => c.path.endsWith("/bookings/9/confirm-payment-received"))).toHaveLength(1);
  });
});

describe("Google Places outage map selection recovery", () => {
  it("selects two Bengaluru coordinates directly on the map and preserves publish ability", async () => {
    render(<LiveCarpool token="driver-token" accountRole="driver" />);
    await waitFor(() => expect(mapClick).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Choose pickup on map" }));
    mapClick({ latLng: { lat: () => 12.976, lng: () => 77.592 } });
    await waitFor(() => expect(screen.getByLabelText("Pickup place")).toHaveValue("Map point (12.97600, 77.59200)"));
    fireEvent.click(screen.getByRole("button", { name: "Choose destination on map" }));
    mapClick({ latLng: { lat: () => 12.972, lng: () => 77.641 } });
    await waitFor(() => expect(screen.getByLabelText("Destination place")).toHaveValue("Map point (12.97200, 77.64100)"));
    fireEvent.click(screen.getByRole("button", { name: "Publish ride" }));
    await waitFor(() => expect(calls.some(c => c.path.endsWith("/offers") && c.method === "POST")).toBe(true));
  });
  it("rejects map clicks outside the service boundary", async () => {
    render(<LiveCarpool token="driver-token" accountRole="driver" />);
    await waitFor(() => expect(mapClick).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Choose pickup on map" }));
    mapClick({ latLng: { lat: () => 18.9, lng: () => 72.8 } });
    expect(await screen.findByText("Select a point inside the Bengaluru service area.")).toBeVisible();
    expect(screen.getByLabelText("Pickup place")).toHaveValue("");
  });
});
