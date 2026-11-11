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
    const body = String(url).endsWith("/membership/me") ? { host_applications: [] } : { data: [] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  render(<AddressRides token="synthetic-session" />);
  fireEvent.change(screen.getByRole("combobox", { name: "Pickup" }), { target: { value: "Indiranagar" } });
  fireEvent.click(await screen.findByRole("option", { name: locations.Indiranagar.label }));
  fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: "Whitefield" } });
  fireEvent.click(await screen.findByRole("option", { name: locations.Whitefield.label }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Find rides" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Find rides" }));
  await screen.findByText("No matching rides yet. Try another pickup time or a nearby address.");
  const profile = requests.find(([url]) => url === "/api/mobility/address-rides/profile");
  expect(JSON.parse(profile[1].body)).toMatchObject({ home: locations.Indiranagar, campus: locations.Whitefield, role: "rider" });
  expect(requests.some(([url]) => url.includes("/address-rides/rides?"))).toBe(true);
  expect(requests.some(([url]) => url.includes("pickup-points"))).toBe(false);
  expect(screen.queryByRole("combobox", { name: "Pickup point" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Offer a ride" }));
  await screen.findByText("Complete driver onboarding and vehicle approval to offer a ride.");
  expect(screen.queryByRole("button", { name: "Offer this ride" })).not.toBeInTheDocument();
});
