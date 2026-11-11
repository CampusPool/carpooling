import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AddressPlacePicker from "../components/AddressPlacePicker";
import AddressRides from "../components/AddressRides";

vi.mock("../lib/maps-loader.mjs", () => ({ loadMapsSdk: ({ onReady }) => { onReady(); return () => {}; } }));
vi.mock("../components/CanonicalRouteMap", () => ({ default: () => <div>Selected address map</div> }));
vi.mock("../components/RideConversation", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const locations = {
  Indiranagar: { label: "12th Main Road, Indiranagar, Bengaluru", lat: 12.9718, lng: 77.6412 },
  Whitefield: { label: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.75 },
};

function mockPlaces() {
  vi.stubGlobal("google", { maps: { importLibrary: async () => ({ AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: async ({ input }) => ({ suggestions: Object.entries(locations)
      .filter(([name]) => name.toLowerCase().includes(input.toLowerCase()))
      .map(([name, place]) => ({ placePrediction: { placeId: name, text: { text: place.label }, toPlace: () => ({
        formattedAddress: place.label, location: { lat: () => place.lat, lng: () => place.lng }, fetchFields: async () => {},
      }) } })),
    }),
  } }) } });
}

it("selects a Places address with the keyboard and invalidates its coordinates when edited", async () => {
  mockPlaces();
  const chosen = vi.fn();
  function Picker() {
    const [value, setValue] = useState();
    return <AddressPlacePicker label="Pickup" ready value={value} onChange={place => { chosen(place); setValue(place); }} />;
  }
  render(<Picker />);
  const input = screen.getByRole("combobox", { name: "Pickup" });
  fireEvent.change(input, { target: { value: "Indiranagar" } });
  await screen.findByRole("option", { name: locations.Indiranagar.label });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(chosen).toHaveBeenLastCalledWith(locations.Indiranagar));
  fireEvent.change(input, { target: { value: "Indiranagar edited" } });
  expect(chosen).toHaveBeenLastCalledWith(undefined);
  expect(input).toHaveValue("Indiranagar edited");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("searches with the two selected Places coordinates without a fixed pickup catalog", async () => {
  mockPlaces();
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push([url, options]);
    const body = String(url).includes("/address-rides/rides?") ? {
      data: [], excluded: [{ reason: "PICKUP_TIME_MISMATCH" }, { reason: "DETOUR_LIMIT_EXCEEDED" }],
    } : { data: [] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  render(<AddressRides token="synthetic-session" />);
  fireEvent.change(screen.getByRole("combobox", { name: "Pickup" }), { target: { value: "Indiranagar" } });
  fireEvent.click(await screen.findByRole("option", { name: locations.Indiranagar.label }));
  fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: "Whitefield" } });
  fireEvent.click(await screen.findByRole("option", { name: locations.Whitefield.label }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Find rides" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
  await screen.findByText(/No matching rides for/);
  expect(screen.getByText(/outside your search window/)).toBeVisible();
  expect(screen.getByText(/longer detour than the driver allowed/)).toBeVisible();
  const profile = requests.find(([url]) => url === "/api/mobility/address-rides/profile");
  expect(JSON.parse(profile[1].body)).toMatchObject({ home: locations.Indiranagar, campus: locations.Whitefield, role: "rider" });
  expect(requests.some(([url]) => url.includes("/address-rides/rides?"))).toBe(true);
  expect(requests.some(([url]) => url.includes("pickup-points"))).toBe(false);
  expect(screen.queryByRole("combobox", { name: "Pickup point" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Offer a ride" }));
  await screen.findByText("Complete driver onboarding and vehicle approval to offer a ride.");
  expect(screen.queryByRole("button", { name: "Offer this ride" })).not.toBeInTheDocument();
});


it("shows private booking updates and marks them read", async () => {
  let read = false;
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push([url, options]);
    if (String(url).endsWith("/notifications/7/read")) read = true;
    const data = String(url).endsWith("/notifications") ? { data: [{ id: 7, title: "New booking request", body: "A rider requested a seat on your ride.", read_at: read ? "2026-11-11" : null }] }
      : String(url).endsWith("/membership/me") ? { host_applications: [] } : { data: [] };
    return new Response(JSON.stringify(data), { status: 200 });
  }));
  render(<AddressRides token="synthetic-session" />);
  fireEvent.click(await screen.findByRole("tab", { name: "Updates (1)" }));
  expect(await screen.findByText("A rider requested a seat on your ride.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument());
  expect(requests.some(([url, options]) => url.endsWith("/notifications/7/read") && options.method === "POST")).toBe(true);
});

it("does not offer cancellation after the ride starts", async () => {
  vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(
    String(url).endsWith("/bookings") ? { data: [{ booking_id: 1, trip_id: 2, request_state: 1, state: "in_progress", departure_at: "2026-11-12T08:30:00+05:30", driver_name: "Driver", pickup_label: "Pickup", dropoff_label: "Destination" }] }
    : String(url).endsWith("/membership/me") ? { host_applications: [] } : { data: [] }
  ), { status: 200 })));
  render(<AddressRides token="synthetic-session" />);
  fireEvent.click(screen.getByRole("tab", { name: "Bookings" }));
  await screen.findByText("Driver");
  expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
});

it("publishes the selected capacity from a server-approved demo car", async () => {
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push([String(url), options]);
    const body = String(url).endsWith("/vehicles") ? {
      demo_vehicle_enabled: true,
      data: [{ id: 8, registration: "KA00DE0007", name: "Maruti Suzuki Swift", vehicle_type: "car", passenger_seats: 4, demo_verified: true }],
    } : { data: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  render(<AddressRides token="synthetic-session" initialMode="offer" rideDefaults={{ origin: locations.Indiranagar, destination: locations.Whitefield }} />);
  const capacity = await screen.findByRole("combobox", { name: "Passenger seats" });
  expect(capacity.querySelectorAll("option")).toHaveLength(4);
  fireEvent.change(capacity, { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish ride" }));
  await screen.findByText("Your ride is published. Riders can now request a seat.");
  const [, request] = requests.find(([url, options]) => url.endsWith("/offers") && options.method === "POST");
  expect(JSON.parse(request.body)).toMatchObject({ car_id: 8, total_seats: 4, vehicle_type: "car" });
});
