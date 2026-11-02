import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "../app/page";

const profile = {
  role: "driver",
  home: { lat: 12.9716, lng: 77.5946, label: "Home" },
  campus: { lat: 12.9352, lng: 77.62, label: "Campus" },
  outbound_time: "08:30",
  return_time: "17:30",
  max_walk_meters: 500,
  weekdays: [1, 2, 3, 4, 5],
};

const offer = {
  trip_id: 91,
  pickup_label: "Home",
  dropoff_label: "Campus",
  vehicle_type: "car",
  choice: "ON_ROUTE_MEETING_POINT",
  seats_available: 1,
  total_seats: 1,
};

const lifecycleBooking = (state) => ({
  booking_id: 701,
  trip_id: 91,
  rider_id: 808,
  pickup_label: "Home",
  dropoff_label: "Campus",
  request_state: 1,
  wallet_state: "held",
  state,
  owner: true,
  fare_minor: 1500,
  participant_state: {
    in_progress: "accepted",
    boarded: "boarded",
    alighted: "alighted",
  }[state],
});

let calls;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installDriverApi({ bookings = [], bookingSnapshots, bookingStatuses = [], offerSnapshots, offerStatuses = [], unauthorizedTransition = false, walletStatus = 200, chatMessages = [], chatParticipants = [{ id: 808, name: "You", blocked_by_you: false }, { id: 909, name: "Rider", blocked_by_you: false }], chatParticipantsByTrip = {}, chatSendFailure = false, reportFailure = false, receiptFailure = false, blockDelay = 0, chatDelay = 0 } = {}) {
  calls = [];
  let bookingFetches = 0;
  let offerFetches = 0;
  let snapshotIndex = 0;
  let chatSendAttempts = 0;
  let reportAttempts = 0;
  let receiptAttempts = 0;
  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body, headers: init.headers || {} });
    if (url === "/api/mobility/commute/demo-session" && method === "POST") return json({ token: "driver-token" });
    if (url === "/api/mobility/commute/me") return json({ profile, user: { id: 808, name: "You" } });
    if (url === "/api/mobility/commute/bookings") {
      const values = bookingSnapshots || [bookings];
      const current = values[Math.min(bookingFetches, values.length - 1)] || [];
      const status = bookingStatuses[Math.min(bookingFetches, bookingStatuses.length - 1)] || 200;
      bookingFetches += 1;
      return json({ data: current }, status);
    }
    if (url === "/api/mobility/commute/wallet") return json({ balance_minor: 50000 }, walletStatus);
    if (url.match(/\/api\/mobility\/trips\/\d+\/messages$/) && method === "GET") {
      const tripId = Number(url.match(/trips\/(\d+)\//)?.[1]);
      if (chatDelay) await new Promise((resolve) => setTimeout(resolve, chatDelay));
      return json({ data: { messages: chatMessages, participants: chatParticipantsByTrip[tripId] || chatParticipants, can_send: true } });
    }
    if (url.match(/\/api\/mobility\/trips\/\d+\/blocks$/) && method === "POST") {
      if (blockDelay) await new Promise((resolve) => setTimeout(resolve, blockDelay));
      return json({ data: { target_user_id: body.target_user_id, blocked: body.blocked } });
    }
    if (url.match(/\/api\/mobility\/trips\/\d+\/messages\/read$/) && method === "POST") return json({ data: { read_through_id: 990 } });
    if (url.match(/\/api\/mobility\/trips\/\d+\/messages$/) && method === "POST") {
      chatSendAttempts += 1;
      if (chatSendFailure && chatSendAttempts === 1) return json({ message: "Temporary chat failure" }, 503);
      return json({ data: { id: 991, user_id: 808, text: body.text } });
    }
    if (url === "/api/mobility/trips/91/reports" && method === "POST") {
      reportAttempts += 1;
      if (reportFailure && reportAttempts === 1) return json({ message: "Temporary report failure" }, 503);
      return json({ data: { id: 992, status: "open" } });
    }
    if (url === "/api/mobility/commute/offers" && method === "GET") {
      const snapshots = offerSnapshots || [[offer]];
      const current = snapshots[Math.min(offerFetches, snapshots.length - 1)] || [];
      const status = offerStatuses[Math.min(offerFetches, offerStatuses.length - 1)] || 200;
      offerFetches += 1;
      return json({ data: current }, status);
    }
    if (url === "/mobility-pilot/maps-config") return json({});
    if (url === "/api/mobility/commute/offers" && method === "POST") return json({ trip: offer });
    if (url.match(/\/api\/mobility\/commute\/bookings\/701\/(accept|reject|cancel)$/) && method === "POST") return json({ booking: { booking_id: 701 } });
    if (url === "/api/mobility/commute/bookings/701/confirm-payment-received" && method === "POST") {
      receiptAttempts += 1;
      if (receiptFailure && receiptAttempts === 1) return json({ message: "Temporary receipt failure" }, 503);
      return json({ receipt: { receipt_number: "DEMO-91-701-ABC123", demo_only: true, synthetic: true, non_redeemable: true } });
    }
    if (url.includes("/api/mobility/commute/trips/91/transition") && method === "POST") {
      if (unauthorizedTransition) return json({ message: "Session expired" }, 401);
      snapshotIndex += 1;
      return json({ booking: { booking_id: 701 } });
    }
    throw new Error(`Unhandled mocked request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function signInDriver() {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: /Offer a ride/i }));
  await screen.findByRole("heading", { name: "Choose your route." });
  await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
}

beforeEach(() => {
  installDriverApi();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("driver journey interactions", () => {
  it("publishes a ride with the selected vehicle, pickup choice, and detour limits", async () => {
    await signInDriver();
    fireEvent.change(document.querySelector('select[name="vehicle"]'), { target: { value: "bike" } });
    fireEvent.change(document.querySelector('select[name="driver_pickup_choice"]'), { target: { value: "ON_ROUTE_MEETING_POINT" } });
    fireEvent.change(document.querySelector('input[name="max_detour_km"]'), { target: { value: "2.5" } });
    fireEvent.change(document.querySelector('input[name="max_detour_min"]'), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish ride" }));

    await screen.findByRole("heading", { name: "Booking activity." });
    const publish = calls.find(({ url, method }) => url.endsWith("/commute/offers") && method === "POST");
    expect(publish.body.vehicle_type).toBe("bike");
    expect(publish.body.choice).toBe("ON_ROUTE_MEETING_POINT");
    expect(publish.body.max_detour_meters).toBe(2500);
    expect(publish.body.max_detour_seconds).toBe(1200);
    expect(screen.getByText(/Ride published\. One rider seat is available/)).toBeInTheDocument();
    expect(screen.getByText(/Published · car · Meet along my route · 1 rider seat available/)).toBeInTheDocument();
  });

  it("refreshes the published ride list from the existing offers endpoint", async () => {
    installDriverApi({ offerSnapshots: [[], [offer]] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findByText("No upcoming rides published. Use the route form to publish a commute.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh rides" }));
    expect(await screen.findByText(/Published · car · Meet along my route/)).toBeInTheDocument();
    expect(calls.filter(({ url, method }) => url.endsWith("/commute/offers") && method === "GET")).toHaveLength(2);
  });

  it("keeps published rides visible when a refresh fails", async () => {
    installDriverApi({ offerStatuses: [200, 503] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findByText(/Published · car · Meet along my route/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh rides" }));
    expect(await screen.findByText("Published rides could not be refreshed. Your current list is kept.")).toBeInTheDocument();
    expect(screen.getByText(/Published · car · Meet along my route/)).toBeInTheDocument();
  });

  it("renders the exact driver lifecycle control and sends passenger_id only for board/alight", async () => {
    installDriverApi({ bookingSnapshots: [
      [lifecycleBooking("planned")],
      [lifecycleBooking("in_progress")],
      [{ ...lifecycleBooking("in_progress"), participant_state: "boarded" }],
      [{ ...lifecycleBooking("in_progress"), participant_state: "alighted" }],
      [{ ...lifecycleBooking("completed"), participant_state: "alighted" }],
    ] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));

    for (const [label, action, expectsPassenger] of [
      ["Start trip", "start", false],
      ["Board rider", "board", true],
      ["Alight rider", "alight", true],
      ["Complete trip", "complete", false],
    ]) {
      fireEvent.click(await screen.findByRole("button", { name: label }));
      await waitFor(() => expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument());
      const transition = calls.filter(({ url, method }) => url.includes("/trips/91/transition") && method === "POST").at(-1);
      expect(transition.body.action).toBe(action);
      if (expectsPassenger) expect(transition.body.passenger_id).toBe(808);
      else expect(transition.body).not.toHaveProperty("passenger_id");
    }
    expect(screen.getByText(/Trip completed · demo credits held/)).toBeInTheDocument();
  });

  it("keeps cancellation and accept actions scoped to the booking", async () => {
    const requested = { ...lifecycleBooking("planned"), request_state: 0, wallet_state: "unpaid" };
    installDriverApi({ bookings: [requested] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(calls.some(({ url }) => url.endsWith("/commute/bookings/701/accept"))).toBe(true));
    const accept = calls.find(({ url }) => url.endsWith("/bookings/701/accept"));
    expect(accept.url).toContain("/bookings/701/accept");
    expect(screen.queryByRole("button", { name: "Confirm payment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(calls.some(({ url }) => url.endsWith("/commute/bookings/701/cancel"))).toBe(true));
  });

  it("confirms a released payment with truthful demo labels and replays the same key after a failed confirmation", async () => {
    const released = { ...lifecycleBooking("completed"), wallet_state: "released", receipt: null };
    const withReceipt = { ...released, receipt: { receipt_number: "DEMO-91-701-ABC123", demo_only: true, synthetic: true, non_redeemable: true } };
    installDriverApi({ bookingSnapshots: [[released], [withReceipt]], receiptFailure: true });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm payment received (demo)" }));
    expect(await screen.findByText("Temporary receipt failure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment received (demo)" }));
    await waitFor(() => expect(screen.getByText(/Demo receipt DEMO-91-701-ABC123/)).toBeInTheDocument());
    expect(screen.getByText(/non-redeemable synthetic credit/)).toBeInTheDocument();
    const confirmations = calls.filter(({ url, method }) => url.endsWith("/confirm-payment-received") && method === "POST");
    expect(confirmations).toHaveLength(2);
    expect(new Headers(confirmations[0].headers).get("Idempotency-Key")).toBe(new Headers(confirmations[1].headers).get("Idempotency-Key"));
  });

  it("clears the session on a 401 lifecycle response", async () => {
    installDriverApi({ bookings: [lifecycleBooking("planned")], unauthorizedTransition: true });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start trip" }));
    expect(await screen.findByRole("button", { name: /Find a ride/i })).toBeInTheDocument();
  });

  it("preserves the driver view while warning when wallet sync is temporarily unavailable", async () => {
    installDriverApi({ walletStatus: 503 });
    await signInDriver();
    expect(await screen.findByText("Could not load wallet right now.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose your route." })).toBeInTheDocument();
  });

  it("refreshes booking activity to pick up an external rider request", async () => {
    const requested = { ...lifecycleBooking("planned"), request_state: 0, wallet_state: "unpaid" };
    installDriverApi({ bookingSnapshots: [[], [requested]] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(screen.getByText("No bookings recorded for this session.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Booking activity refreshed");
    expect(calls.filter(({ url }) => url.endsWith("/commute/me") || url.endsWith("/commute/wallet")).length).toBe(2);
  });

  it("keeps existing bookings when a refresh fails", async () => {
    const existing = lifecycleBooking("planned");
    installDriverApi({ bookings: [existing], bookingStatuses: [200, 503] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect((await screen.findAllByText("Home → Campus")).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Could not load bookings right now.")).toBeInTheDocument();
    expect(screen.getAllByText("Home → Campus").length).toBeGreaterThanOrEqual(2);
  });

  it("opens canonical trip chat only from an accepted booking and sends through the trip endpoint", async () => {
    const existing = lifecycleBooking("planned");
    installDriverApi({ bookings: [existing], chatMessages: [{ id: 990, user_id: 808, text: "Ready at pickup" }] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Trip chat" }));
    expect(await screen.findByText("Ready at pickup")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Trip chat message" })).toHaveAttribute("maxLength", "800");
    expect(calls.some(({ url, method }) => url === "/api/mobility/trips/91/messages" && method === "GET")).toBe(true);
    expect(calls.some(({ url, method, body }) => url === "/api/mobility/trips/91/messages/read" && method === "POST" && body.through_id === 990)).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Trip chat message" }), { target: { value: "I am on the way" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh chat" }));
    await screen.findByText("Ready at pickup");
    expect(screen.getByRole("textbox", { name: "Trip chat message" })).toHaveValue("I am on the way");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url === "/api/mobility/trips/91/messages" && method === "POST" && body.text === "I am on the way")).toBe(true));
    expect(await screen.findByText("I am on the way")).toBeInTheDocument();
  });

  it("blocks a chat participant through the canonical scoped block endpoint", async () => {
    const existing = lifecycleBooking("planned");
    installDriverApi({ bookings: [existing] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Trip chat" }));
    expect(await screen.findByText("Participant safety")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Block participant" }));
    await waitFor(() => expect(calls.some(({ url, method }) => url === "/api/mobility/trips/91/blocks" && method === "POST")).toBe(true));
    const block = calls.find(({ url, method }) => url === "/api/mobility/trips/91/blocks" && method === "POST");
    expect(block.body).toEqual({ target_user_id: 909, blocked: true });
    expect(block.headers.get("Idempotency-Key")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(screen.getByText(/does not cancel rides/)).toBeInTheDocument();
    const firstKey = block.headers.get("Idempotency-Key");
    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Block participant" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Block participant" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unblock" })).toBeInTheDocument());
    const blockCalls = calls.filter(({ url, method }) => url === "/api/mobility/trips/91/blocks" && method === "POST");
    expect(blockCalls).toHaveLength(3);
    expect(blockCalls.map((call) => call.body.blocked)).toEqual([true, false, true]);
    expect(blockCalls[2].headers.get("Idempotency-Key")).not.toBe(firstKey);
  });

  it("clears old participants while switching trip chats", async () => {
    const first = lifecycleBooking("planned");
    const second = { ...lifecycleBooking("planned"), booking_id: 702, trip_id: 92 };
    installDriverApi({ bookings: [first, second], chatParticipantsByTrip: {
      91: [{ id: 808, name: "You", blocked_by_you: false }, { id: 909, name: "First rider", blocked_by_you: false }],
      92: [{ id: 808, name: "You", blocked_by_you: false }, { id: 910, name: "Second rider", blocked_by_you: false }],
    }, chatDelay: 25 });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    const chatButtons = await screen.findAllByRole("button", { name: "Trip chat" });
    fireEvent.click(chatButtons[0]);
    expect(await screen.findByText("First rider")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Trip chat" })[1]);
    expect(screen.queryByText("First rider")).not.toBeInTheDocument();
    expect(await screen.findByText("Second rider")).toBeInTheDocument();
  });

  it("returns to signed-out state if logout races a pending block", async () => {
    installDriverApi({ bookings: [lifecycleBooking("planned")], blockDelay: 50 });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Trip chat" }));
    fireEvent.click(await screen.findByRole("button", { name: "Block participant" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: /Find a ride/i })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(screen.getByRole("button", { name: /Find a ride/i })).toBeInTheDocument();
  });

  it("submits a participant-scoped trip report through the canonical endpoint", async () => {
    installDriverApi({ bookings: [lifecycleBooking("planned")] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Report issue" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Report subject" }), { target: { value: "Unsafe pickup" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Report details" }), { target: { value: "The pickup point was not safe." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(calls.some(({ url, method }) => url === "/api/mobility/trips/91/reports" && method === "POST")).toBe(true));
    const report = calls.find(({ url, method }) => url === "/api/mobility/trips/91/reports" && method === "POST");
    expect(report.body).toEqual({ subject: "Unsafe pickup", message_markdown: "The pickup point was not safe." });
    expect(report.headers.get("Idempotency-Key")).toBeTruthy();
    expect(await screen.findByRole("status")).toHaveTextContent("Report submitted to support.");
  });

  it("hides reports for pending requests and rotates the key when the payload changes", async () => {
    const pending = { ...lifecycleBooking("planned"), request_state: 0, owner: false };
    installDriverApi({ bookings: [pending, { ...pending, state: "in_progress", booking_id: 702 }, { ...pending, state: "completed", booking_id: 703 }, { ...pending, state: "accepted", status: "accepted", booking_id: 704 }], reportFailure: true });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(screen.queryByRole("button", { name: "Report issue" })).not.toBeInTheDocument();

    installDriverApi({ bookings: [lifecycleBooking("planned")], reportFailure: true });
    cleanup();
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Report issue" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Report subject" }), { target: { value: "Unsafe pickup" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Report details" }), { target: { value: "First details" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByText("Temporary report failure");
    const firstKey = calls.find(({ url, method }) => url.endsWith("/reports") && method === "POST").headers.get("Idempotency-Key");
    fireEvent.change(screen.getByRole("textbox", { name: "Report details" }), { target: { value: "Changed details" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByRole("status");
    const sends = calls.filter(({ url, method }) => url.endsWith("/reports") && method === "POST");
    expect(sends).toHaveLength(2);
    expect(sends[1].headers.get("Idempotency-Key")).not.toBe(firstKey);
  });

  it("reuses the idempotency key when retrying an unchanged chat draft", async () => {
    const existing = lifecycleBooking("planned");
    installDriverApi({ bookings: [existing], chatSendFailure: true });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Trip chat" }));
    await screen.findByText("No messages yet.");
    fireEvent.change(screen.getByRole("textbox", { name: "Trip chat message" }), { target: { value: "retry me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Temporary chat failure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls.filter(({ url, method }) => url === "/api/mobility/trips/91/messages" && method === "POST")).toHaveLength(2));
    const sends = calls.filter(({ url, method }) => url === "/api/mobility/trips/91/messages" && method === "POST");
    expect(sends[0].body.text).toBe("retry me");
    expect(sends[0].headers["Idempotency-Key"]).toBe(sends[1].headers["Idempotency-Key"]);
  });

  it("scopes a draft and send retry to the selected trip", async () => {
    const first = lifecycleBooking("planned");
    const second = { ...lifecycleBooking("planned"), booking_id: 702, trip_id: 92 };
    installDriverApi({ bookings: [first, second] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    const chatButtons = await screen.findAllByRole("button", { name: "Trip chat" });
    fireEvent.click(chatButtons[0]);
    await screen.findByText("No messages yet.");
    fireEvent.change(screen.getByRole("textbox", { name: "Trip chat message" }), { target: { value: "trip scoped" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Trip chat" })[1]);
    await screen.findByText("Trip chat · trip 92");
    expect(screen.getByRole("textbox", { name: "Trip chat message" })).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox", { name: "Trip chat message" }), { target: { value: "trip scoped" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls.some(({ url, method, body }) => url === "/api/mobility/trips/92/messages" && method === "POST" && body.text === "trip scoped")).toBe(true));
  });

  it("resets pending chat state when signing out", async () => {
    const existing = lifecycleBooking("planned");
    installDriverApi({ bookings: [existing] });
    await signInDriver();
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Trip chat" }));
    await screen.findByText("No messages yet.");
    fireEvent.click(screen.getByRole("button", { name: "Refresh chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    fireEvent.click(screen.getByRole("button", { name: /Offer a ride/i }));
    await screen.findByRole("heading", { name: "Choose your route." });
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect((await screen.findAllByRole("button", { name: "Trip chat" }))[0]).not.toBeDisabled();
  });
});
