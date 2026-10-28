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
const completedBooking = {
  booking_id: 7,
  trip_id: 42,
  rider_id: 9,
  driver_id: 12,
  owner: false,
  request_state: 1,
  state: "completed",
  wallet_state: "released",
  pickup_label: "Rider pickup",
  dropoff_label: "Rider destination",
  total_fare_minor: 1500,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installApi({ rides = [ride], requestStatus = 200, bookings = [], ratings = [], ratingPost, bookingsStatus = 200, waitlist = [], waitlistRefreshStatus = 200, trustedShareExpiry = "2026-10-28T05:00:00.000Z", operator = false } = {}) {
  calls = [];
  let bookingReads = 0;
  let currentWaitlist = waitlist;
  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined, key: new Headers(init.headers).get("Idempotency-Key") });
    if (url === "/api/login" && method === "POST") return operator ? json({ token: "signed-admin-token" }) : json({ message: "invalid credentials" }, 401);
    if (url === "/api/mobility/commute/demo-session" && method === "POST") return json({ token: "rider-token" });
    if (url === "/api/mobility/commute/me") return json({ profile, operator });
    if (url === "/api/mobility/operator/dashboard") return json({ usage: { demo_actors: 1, demo_trips: 1, bookings: 0, waitlist_pending: 0, reports_open: 1, ratings_submitted: 0 }, reports: [{ id: 77, trip_id: 42, subject: "Pickup report", status: "Open", priority: "high", unread_for_admin: true }] });
    if (url === "/api/admin/support/tickets/77") return json({ data: { id: 77, trip_id: 42, subject: "Pickup report", status: "Open", message_markdown: "Synthetic report" } });
    if (url === "/api/admin/support/tickets/77/resolve" || url === "/api/admin/support/tickets/77/assign-me" || url === "/api/admin/support/tickets/77/needs-review") return json({ data: { id: 77, status: url.endsWith("resolve") ? "Resolved" : "Open" } });
    if (url === "/api/mobility/commute/bookings") {
      const status = Array.isArray(bookingsStatus) ? (bookingsStatus[Math.min(bookingReads++, bookingsStatus.length - 1)] || 200) : bookingsStatus;
      return status === 200 ? json({ data: bookings }) : json({ message: "bookings temporarily unavailable" }, status);
    }
    if (url === "/api/mobility/commute/waitlist") return json({ data: currentWaitlist });
    if (url === "/api/mobility/commute/wallet") return json({ balance_minor: 2500 });
    if (url.includes("/api/mobility/commute/rides?") && method === "GET") return json({ data: rides });
    if (url === "/mobility-pilot/maps-config") return json({});
    if (url === "/api/mobility/commute/profile" && method === "PUT") return json({ profile });
    if (url === "/api/mobility/trips/42/ratings" && method === "GET") return json({ data: ratings });
    if (url === "/api/mobility/trips/42/ratings" && method === "POST") {
      if (ratingPost) return ratingPost({ init, calls });
      return json({ data: { id: 1, trip_id: 42, rating: 5 } }, 201);
    }
    if (url === "/api/mobility/trips/42/trusted-shares" && method === "POST") return json({ data: { grant_id: 55, scope: "status", token: "secret-token", expires_at: trustedShareExpiry } }, 201);
    if (url === "/api/mobility/trips/42/trusted-shares/55" && method === "DELETE") return json({ data: { grant_id: 55, revoked: true } });
    if (url === "/api/mobility/commute/rides/42/request" && method === "POST") {
      return requestStatus === 200
        ? json({ booking: { id: 7, request_state: 0 } })
        : json({ message: "This ride is no longer available." }, requestStatus);
    }
    if (url === "/api/mobility/commute/rides/42/waitlist" && method === "POST") { currentWaitlist = [{ id: 9, trip_id: 42, status: "pending", actionable: true }]; return json({ data: currentWaitlist[0] }); }
    if (url === "/api/mobility/commute/waitlist/9/refresh" && method === "POST" && waitlistRefreshStatus !== 200) return json({ error: { code: "WAITLIST_NOT_ACTIONABLE" } }, waitlistRefreshStatus);
    if (url === "/api/mobility/commute/waitlist/9/refresh" && method === "POST") return json({ data: { id: 9, trip_id: 42, quote_token: "fresh-9", terms: { pickup_label: "Fresh home", dropoff_label: "Fresh campus", access_meters: 80, egress_meters: 40, fare_minor: 1500, pickup_at: "2026-10-28T03:00:00.000Z" } } });
    if (url === "/api/mobility/commute/waitlist/9/cancel" && method === "POST") { currentWaitlist = []; return json({ data: { id: 9, trip_id: 42, status: "cancelled" } }); }
    throw new Error(`Unhandled mocked request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function signInAndWait() {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: /Find a ride/i }));
  await screen.findByRole("heading", { name: "Choose your route." });
  await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
}

async function searchSavedRoute() {
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

describe("rider journey interactions", () => {
  it("uses the saved profile route without an unnecessary profile PUT", async () => {
    await signInAndWait();
    await searchSavedRoute();
    expect(screen.getByText("Total demo fare ₹15.00")).toBeInTheDocument();
    expect(calls.filter(({ url, method }) => url.endsWith("/commute/profile") && method === "PUT")).toHaveLength(0);
    expect(calls.filter(({ url }) => url.includes("/commute/rides?")).length).toBe(1);
  });

  it("renders a rider's server receipt as synthetic and non-redeemable", async () => {
    installApi({ bookings: [{ ...completedBooking, receipt: { receipt_number: "DEMO-42-7-ABC123", demo_only: true, synthetic: true, non_redeemable: true } }] });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findByText(/Demo receipt DEMO-42-7-ABC123/)).toBeInTheDocument();
    expect(screen.getByText(/non-redeemable synthetic credit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm payment received (demo)" })).not.toBeInTheDocument();
  });

  it("shows the server-provided deterministic match rank and reasons", async () => {
    installApi({ rides: [
      { ...ride, trip_id: 20, rank: 1, ranking_score: 10, ranking_reasons: ["0 min from requested pickup", "0 min added detour", "141 m total walking", "₹15.00 demo fare", "1 seat(s) available"] },
      { ...ride, trip_id: 21, rank: 2, ranking_score: 20, ranking_reasons: ["10 min from requested pickup", "5 min added detour", "40 m total walking", "₹9.00 demo fare", "1 seat(s) available"] },
    ] });
    await signInAndWait();
    await searchSavedRoute();
    expect(screen.getByText("#1 match")).toBeInTheDocument();
    expect(screen.getByText("#2 match")).toBeInTheDocument();
    expect(screen.getByText(/Matches are ranked by pickup-time fit/)).toBeInTheDocument();
    const cards = Array.from(document.querySelectorAll("article.ride"));
    expect(cards[0]).toHaveTextContent("0 min from requested pickup");
    expect(cards[1]).toHaveTextContent("10 min from requested pickup");
  });

  it("derives ride duration from confirmed ride seconds when minutes are absent", async () => {
    installApi({ rides: [{ ...ride, duration_minutes: undefined, ride_seconds: 1951 }] });
    await signInAndWait();
    await searchSavedRoute();
    expect(screen.getByText("33 min")).toBeInTheDocument();
  });

  it("rejects altered text until a Places selection supplies new coordinates", async () => {
    await signInAndWait();
    fireEvent.change(screen.getByDisplayValue("Home"), { target: { value: "Unselected address" } });
    fireEvent.click(screen.getByRole("button", { name: "Search rides" }));
    expect(await screen.findByText("Select both places from Google Places suggestions.")).toBeInTheDocument();
    expect(calls.filter(({ url }) => url.includes("/commute/rides?")).length).toBe(0);
    expect(calls.filter(({ url, method }) => url.endsWith("/commute/profile") && method === "PUT")).toHaveLength(0);
  });

  it("requires full fare consent before requesting and sends the quote token after consent", async () => {
    await signInAndWait();
    await searchSavedRoute();
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(await screen.findByText("Agree to the fare before requesting this ride.")).toBeInTheDocument();
    expect(calls.filter(({ url, method }) => url.endsWith("/42/request") && method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url.endsWith("/42/request") && method === "POST" && body.quote_token === "quote-42")).toBe(true));
    expect(await screen.findByRole("status")).toHaveTextContent("Ride request sent");
    expect(screen.getByRole("heading", { name: "Booking activity." })).toBeInTheDocument();
  });

  it("surfaces a failed booking request without claiming success", async () => {
    installApi({ requestStatus: 409 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signInAndWait();
    await searchSavedRoute();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(await screen.findByText("This ride is no longer available.")).toBeInTheDocument();
  });

  it("labels a full ride as waitlist-only and lets the rider cancel their request", async () => {
    installApi({ rides: [{ ...ride, seats_available: 0, waitlist_available: true }] });
    await signInAndWait();
    await searchSavedRoute();
    expect(screen.getByText(/does not reserve a seat and never auto-approves/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join waitlist" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url.endsWith("/42/waitlist") && method === "POST" && body.quote_token === "quote-42")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Waitlist" }));
    expect(await screen.findByText(/A seat is available for your turn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh eligibility and terms" }));
    expect(await screen.findByText("Route Fresh home → Fresh campus")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: /refreshed route/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel waitlist" }));
    await waitFor(() => expect(calls.some(({ url, method }) => url.endsWith("/waitlist/9/cancel") && method === "POST")).toBe(true));
  });

  it("explains an unavailable waitlist entry instead of displaying an object", async () => {
    installApi({ waitlist: [{ id: 9, trip_id: 42, status: "pending", actionable: false }], waitlistRefreshStatus: 409 });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Waitlist" }));
    fireEvent.click(await screen.findByRole("button", { name: "Refresh eligibility and terms" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This waitlist entry is not actionable yet");
  });

  it("lets a rider cancel the pending booking created from a waitlist entry", async () => {
    installApi({ waitlist: [{ id: 9, trip_id: 42, status: "requested", actionable: false }] });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Waitlist" }));
    expect(await screen.findByText(/You requested a seat and are waiting for driver review/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel seat request" }));
    await waitFor(() => expect(calls.some(({ url, method }) => url.endsWith("/waitlist/9/cancel") && method === "POST")).toBe(true));
  });

  it("opens the saved driver route from booking activity", async () => {
    installApi({
      bookings: [{
        booking_id: 7,
        request_state: 1,
        state: "planned",
        wallet_state: "held",
        pickup_label: "Rider pickup",
        dropoff_label: "Rider destination",
        driver_route_origin_label: "Published origin",
        driver_route_destination_label: "Published destination",
        total_fare_minor: 1500,
        route_map: ride.route_map,
      }],
    });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findByRole("heading", { name: "Booking activity." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View route" }));
    expect(await screen.findByRole("heading", { name: "Choose your route." })).toBeInTheDocument();
    expect(screen.getByText("Showing the saved driver route for this booking.")).toBeInTheDocument();
    expect(screen.getByText("Published origin → Published destination")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Home")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Campus")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Home"), { target: { value: "Different" } });
    expect(screen.queryByText("Showing the saved driver route for this booking.")).not.toBeInTheDocument();
    expect(screen.queryByText("Published origin → Published destination")).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("To campus"), { target: { value: "return" } });
    expect(screen.queryByText("Showing the saved driver route for this booking.")).not.toBeInTheDocument();
    expect(screen.getByText(/Choose a suggestion to save exact coordinates/)).toBeInTheDocument();
  });

  it("rates a completed trip, receives 201, and views the API ratings", async () => {
    installApi({ bookings: [completedBooking], ratings: [{ id: 1, trip_id: 42, rating: 4, comment: "Kind driver", direction: "received" }] });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate trip" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Trip rating" }), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Rating comment" }), { target: { value: "Safe ride" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url.endsWith("/trips/42/ratings") && method === "POST" && body.rating === 5 && body.comment === "Safe ride")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Trip rating form" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "View ratings" }));
    expect(await screen.findByText("Received rating · 4/5")).toBeInTheDocument();
    expect(screen.getByText("Kind driver")).toBeInTheDocument();
  });

  it("keeps the successful rating status when the follow-up booking refresh fails", async () => {
    installApi({ bookings: [completedBooking], bookingsStatus: [200, 503] });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Trip rating form" })).not.toBeInTheDocument());
    expect(await screen.findByRole("status")).toHaveTextContent("Rating submitted");
    expect(screen.getByText("Could not load bookings right now.")).toBeInTheDocument();
  });

  it("reuses an ambiguous-send key after reopening, but changes it for edited payloads", async () => {
    let attempts = 0;
    installApi({ bookings: [completedBooking], ratingPost: ({ init }) => {
      attempts += 1;
      return attempts < 3 ? json({ message: "temporary failure" }, 503) : json({ data: { id: 2 } }, 201);
    } });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    expect(await screen.findByText("temporary failure")).toBeInTheDocument();
    const firstKey = calls.find(({ method, url }) => method === "POST" && url.endsWith("/trips/42/ratings")).key;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Rate trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(calls.filter(({ method, url }) => method === "POST" && url.endsWith("/trips/42/ratings")).length).toBe(2));
    const secondKey = calls.filter(({ method, url }) => method === "POST" && url.endsWith("/trips/42/ratings"))[1].key;
    expect(secondKey).toBe(firstKey);
    fireEvent.click(screen.getByRole("button", { name: "Rate trip" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Trip rating" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(calls.filter(({ method, url }) => method === "POST" && url.endsWith("/trips/42/ratings")).length).toBe(3));
    expect(calls.filter(({ method, url }) => method === "POST" && url.endsWith("/trips/42/ratings"))[2].key).not.toBe(firstKey);
  });

  it("keeps a ratings read error visible when the panel was not previously open", async () => {
    installApi({ bookings: [completedBooking], ratingPost: undefined });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      if (String(input).endsWith("/trips/42/ratings") && (!init.method || init.method === "GET")) return json({ message: "ratings unavailable" }, 503);
      return originalFetch(input, init);
    }));
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "View ratings" }));
    expect(await screen.findByText("ratings unavailable")).toBeInTheDocument();
  });

  it("tracks completed-trip ratings per counterpart for multi-rider drivers", async () => {
    installApi({ bookings: [{ ...completedBooking, owner: true }, { ...completedBooking, owner: true, booking_id: 8, rider_id: 10 }] });
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /Offer a ride/i }));
    await screen.findByRole("heading", { name: "Choose your route." });
    await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findAllByRole("button", { name: "Rate trip" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Rate trip" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Rate trip" })).toHaveLength(1));
  });

  it("does not update the completed-trip form after sign-out wins a pending submit", async () => {
    let resolvePost;
    installApi({ bookings: [completedBooking], ratingPost: () => new Promise((resolve) => { resolvePost = resolve; }) });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    resolvePost(json({ data: { id: 3 } }, 201));
    await waitFor(() => expect(screen.getByRole("button", { name: /Find a ride/i })).toBeInTheDocument());
    expect(screen.queryByText("Rating submitted")).not.toBeInTheDocument();
  });

  it("creates a status-only trusted link without displaying or copying the token automatically", async () => {
    installApi({ bookings: [completedBooking] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create trusted status link" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url.endsWith("/trips/42/trusted-shares") && method === "POST" && body.scope === "status" && body.expires_in_minutes === 120)).toBe(true));
    expect(screen.getByText(/Anyone with the link can view status/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/not sent automatically/i);
    expect(screen.queryByText("secret-token")).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/api/mobility/trusted-shares/secret-token")));
    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    await waitFor(() => expect(calls.some(({ url, method }) => url.endsWith("/trips/42/trusted-shares/55") && method === "DELETE")).toBe(true));
  });

  it("clears trusted link state on sign-out", async () => {
    installApi({ bookings: [completedBooking] });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create trusted status link" }));
    await screen.findByRole("button", { name: "Copy link" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: /Find a ride/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByText("secret-token")).not.toBeInTheDocument();
  });

  it("does not offer copying for an expired grant and offers a fresh link instead", async () => {
    installApi({ bookings: [completedBooking], trustedShareExpiry: "2020-01-01T00:00:00.000Z" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await signInAndWait();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create trusted status link" }));
    expect(await screen.findByRole("button", { name: "Create trusted status link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses the authenticated admin support endpoints for report resolution", async () => {
    installApi({ operator: true });
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /Find a ride/i }));
    await screen.findByRole("heading", { name: "Choose your route." });
    fireEvent.click(screen.getByRole("button", { name: "Operations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open report" }));
    expect(await screen.findByText("Synthetic report")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(calls.some(({ url, method, key }) => url === "/api/admin/support/tickets/77/resolve" && method === "POST" && typeof key === "string" && key.length > 20)).toBe(true));
  });

  it("opens Operations only after real administrator login reports operator capability", async () => {
    installApi({ operator: true });
    render(<Page />);
    fireEvent.click(screen.getByText("Administrator sign-in"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in as administrator" }));
    expect(await screen.findByRole("button", { name: "Operations" })).toBeInTheDocument();
    expect(calls.some(({ url, method, body }) => url === "/api/login" && method === "POST" && body.email === "admin@example.invalid")).toBe(true);
  });
});
