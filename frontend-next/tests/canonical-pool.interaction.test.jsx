import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CanonicalPool from "../components/CanonicalPool";
import CanonicalPlacePicker from "../components/CanonicalPlacePicker";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const pointData = { data: [{ id: 101, name: "Campus Gate" }, { id: 102, name: "Library" }] };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("canonical pool screen", () => {
  it("turns a Places address into an explicit nearby canonical stop selection", async () => {
    const suggestion = { placePrediction: { placeId: "place-1", text: { text: "Central Library, Bengaluru" }, toPlace: () => ({
      fetchFields: vi.fn(async () => {}), formattedAddress: "Central Library, Bengaluru", location: { lat: () => 12.9701, lng: () => 77.5901 },
    }) } };
    vi.stubGlobal("google", { maps: { importLibrary: async () => ({ AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [suggestion] }) } }) } });
    render(<CanonicalPlacePicker label="Pickup point" name="pickup_point_id" points={[
      { id: 101, name: "Campus Gate", lat: 12.97, lng: 77.59 }, { id: 102, name: "Library", lat: 13.02, lng: 77.64 },
    ]} />);
    fireEvent.change(screen.getByLabelText("Search pickup point by address"), { target: { value: "Central Library" } });
    fireEvent.click(await screen.findByRole("button", { name: "Central Library, Bengaluru" }));
    const nearest = await screen.findByRole("button", { name: /Campus Gate/ });
    expect(nearest.textContent).toMatch(/m from address/);
    fireEvent.click(nearest);
    expect(screen.getByLabelText("Pickup point")).toHaveValue("101");
    expect(screen.getByRole("status")).toHaveTextContent("approved pickup catalog");
  });

  it("quotes and publishes with an approved host vehicle and idempotency key", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET"; const body = init.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body, headers: new Headers(init.headers) });
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: true }, host_applications: [{ car_id: 7, vehicle_type: "car", status: "approved" }] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [{ id: 7, brand: "Honda", model: "City" }] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [{ car_id: 7, vehicle_type: "car", status: "approved", legal_passenger_capacity: 2 }] });
      if (url === "/api/mobility/routes/quote" && method === "POST") {
        expect(body).toEqual({ pickup_point_id: 101, dropoff_point_id: 102, vehicle_type: "car" });
        return json({ data: { id: "quote-uuid", currency: "INR", seat_price_minor: 8500, distance_meters: 12000, duration_seconds: 1800, expires_at: new Date(Date.now() + 300000).toISOString(), vehicle_type: "car", synthetic_only: true } }, 201);
      }
      if (url === "/api/mobility/pool-offers" && method === "POST") {
        expect(body).toMatchObject({ quote_id: "quote-uuid", car_id: 7, total_seats: 2 });
        expect(init.headers["Idempotency-Key"] || new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
        return json({ data: { id: 99 } }, 201);
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.click(screen.getByRole("button", { name: "Publish a ride" }));
    fireEvent.change(screen.getByLabelText("Approved vehicle"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Pickup point"), { target: { value: "101" } });
    fireEvent.change(screen.getByLabelText("Drop-off point"), { target: { value: "102" } });
    fireEvent.click(screen.getByRole("button", { name: "Get route quote" }));
    await screen.findByText(/Synthetic test quote/);
    expect(screen.getByLabelText("Passenger seats")).toHaveAttribute("max", "2");
    fireEvent.change(screen.getByLabelText("Departure date and time (India time)"), { target: { value: `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000))}T12:00` } });
    const publishForm = screen.getByRole("button", { name: "Publish quoted ride" }).closest("form");
    fireEvent.change(screen.getByLabelText("Passenger seats"), { target: { value: "3" } });
    fireEvent.submit(publishForm);
    await screen.findByText("Passenger seats must be between 1 and the reviewed vehicle capacity (2).");
    expect(calls.some((call) => call.url === "/api/mobility/pool-offers" && call.method === "POST")).toBe(false);
    fireEvent.change(screen.getByLabelText("Passenger seats"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish quoted ride" }));
    await screen.findByText("Ride #99 published. Riders can now request seats.");
    expect(calls.some((call) => call.url === "/api/mobility/pool-offers" && call.method === "POST")).toBe(true);
  });

  it("searches segments and requests through the canonical match reference", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET"; const body = init.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body, headers: new Headers(init.headers) });
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: false }, host_applications: [] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [] });
      if (url === "/api/mobility/pool-matches" && method === "POST") {
        expect(body).toMatchObject({ service_date: expect.any(String), pickup_point_id: 101, dropoff_point_id: 102, from_time: "00:00", to_time: "23:59", preferred_time: "08:30" });
        return json({ data: [{ match_id: "match-uuid", host_name: "Rhea", vehicle_type: "car", vehicle_label: "Honda City", pickup_point_id: 101, dropoff_point_id: 102, pickup_local: "2026-11-03T08:30:00+05:30", dropoff_local: "2026-11-03T09:00:00+05:30", seats_available: 2, seat_price_minor: 1250, expires_at: new Date(Date.now() + 300000).toISOString() }] });
      }
      if (url === "/api/mobility/pool-matches/match-uuid/requests" && method === "POST") return json({ data: { trip_id: 14, booking_id: 22, request_state: 0 } }, 201);
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.change(screen.getByLabelText("Pickup point"), { target: { value: "101" } });
    fireEvent.change(screen.getByLabelText("Drop-off point"), { target: { value: "102" } });
    fireEvent.click(screen.getByRole("button", { name: "Search available seats" }));
    expect(await screen.findByText("Host: Rhea · Vehicle: Honda City")).toBeInTheDocument();
    expect(screen.getByText(/2 seats free · ₹12.50 per passenger/)).toBeInTheDocument();
    expect(screen.getByText(/Pickup .* · drop-off /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request one seat" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Request one seat" }));
    await screen.findByText("Seat requested. The host must still accept it.");
    const request = calls.find((call) => call.url.endsWith("/requests") && call.method === "POST");
    expect(request.url).toBe("/api/mobility/pool-matches/match-uuid/requests");
    expect(request.headers.get("Idempotency-Key")).toBeTruthy();
    expect(request.body).toEqual({});
  });

  it("lets hosts accept pending rider requests using canonical trip endpoints", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET";
      calls.push({ url, method });
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: true }, host_applications: [] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [] });
      if (url === "/api/users/requests") return json({ data: [{ id: 52, trip_id: 14, state: 0, user: { id: 42, name: "Rider One" } }] });
      if (url === "/api/users/seat-requests") return json({ data: [] });
      if (url === "/api/users/me") return json({ data: { id: 31 } });
      if (url === "/api/trips/14/requests/42/accept" && method === "POST") return json({ data: { request_state: 1 } });
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.click(screen.getByRole("button", { name: "Booking requests" }));
    await screen.findByText("Rider One");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByText("Seat request accepted.");
    expect(calls.some((call) => call.url === "/api/trips/14/requests/42/accept" && call.method === "POST")).toBe(true);
    expect(calls.some((call) => call.url === "/api/users/requests" && call.method === "GET")).toBe(true);
    expect(calls.some((call) => call.url.match(/\/api\/trips\/\d+\/requests$/))).toBe(false);
  });

  it("lets riders cancel their own active canonical booking", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET";
      calls.push({ url, method });
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: false }, host_applications: [] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [] });
      if (url === "/api/users/get-trips") return json({ data: [] });
      if (url === "/api/users/seat-requests") return json({ data: [{ id: 22, trip_id: 14, request_state: 0 }] });
      if (url === "/api/users/me") return json({ data: { id: 31 } });
      if (url === "/api/trips/14/requests/31/cancel" && method === "POST") return json({ data: { request_state: 3 } });
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.click(screen.getByRole("button", { name: "Booking requests" }));
    await screen.findByText("Pending host approval");
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    await screen.findByText("Your seat request was cancelled.");
    expect(calls.some((call) => call.url === "/api/trips/14/requests/31/cancel" && call.method === "POST")).toBe(true);
  });

  it("shows booking refresh failures and disables actions for invalid identities or rider IDs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: false }, host_applications: [] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [] });
      if (url === "/api/users/requests") return json({ data: [{ id: 999, trip_id: 15, state: 0, user: { id: "bad-user-id" } }] });
      if (url === "/api/users/seat-requests") return json({ error: { message: "temporary failure" } }, 503);
      if (url === "/api/users/me") return json({ data: { id: "not-a-user-id" } });
      throw new Error(`Unhandled request ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.click(screen.getByRole("button", { name: "Booking requests" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Your seat requests could not be loaded/);
    expect(screen.getByRole("alert")).toHaveTextContent(/account identity response is invalid/);
    expect(screen.queryByRole("button", { name: "Cancel request" })).not.toBeInTheDocument();
    expect(screen.getByText("Rider unknown")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Accept" })[0]).toBeDisabled();
    expect(screen.queryByText("No pending seat requests for your rides.")).not.toBeInTheDocument();
  });

  it("keeps legacy approved vehicles without reviewed capacity unavailable for publishing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url === "/api/mobility/membership/me") return json({ capabilities: { discover: true, request: true, publish: true }, host_applications: [{ car_id: 7, vehicle_type: "car", status: "approved" }] });
      if (url === "/api/mobility/pickup-points?page_size=50") return json(pointData);
      if (url === "/api/cars") return json({ data: [{ id: 7, brand: "Honda", model: "City" }] });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [{ car_id: 7, vehicle_type: "car", status: "approved", legal_passenger_capacity: null }] });
      throw new Error(`Unhandled request ${url}`);
    }));

    render(<CanonicalPool token="session-token" />);
    await screen.findByText("not applied");
    fireEvent.click(screen.getByRole("button", { name: "Publish a ride" }));
    expect(await screen.findByText(/missing a valid reviewed passenger-seat capacity/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get route quote" })).toBeDisabled();
    expect(screen.queryByLabelText("Passenger seats")).not.toBeInTheDocument();
  });
});
