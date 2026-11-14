import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "../app/page";

const profile = {
  role: "rider",
  home: { lat: 12.9716, lng: 77.5946, label: "Home" },
  campus: { lat: 12.9352, lng: 77.62, label: "Campus" },
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installMocks() {
  const pending = [];
  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = String(input);
    if (url === "/api/mobility/local-auth/config") return json({ enabled: true });
    if (url === "/api/mobility/local-auth/register" && init.method === "POST") return json({ token: "rider-token", role: "rider", user: { id: 9, name: "rider_test" } }, 201);
    if (url === "/api/mobility/commute/me") return json({ profile });
    if (url === "/api/mobility/commute/bookings") return json({ data: [] });
    if (url === "/api/mobility/commute/waitlist") return json({ data: [] });
    if (url === "/api/mobility/commute/wallet") return json({ balance_minor: 2500 });
    if (url === "/api/mobility/commute/notifications") return json({ data: [] });
    if (url === "/api/maps/config") return json({ browser_key: "test-key" });
    throw new Error(`Unhandled mocked request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const place = {
    displayName: { text: "PES University" },
    formattedAddress: "PES University, Bengaluru, Karnataka, India",
    location: { lat: () => 12.9352, lng: () => 77.5347 },
    fetchFields: vi.fn(async () => undefined),
  };
  const prediction = {
    placeId: "pes-1",
    // The Places (New) FormattableText shape used by the IAB exposes `.text`.
    text: { text: "PES University, Bengaluru" },
    toPlace: () => place,
  };
  const suggestionApi = {
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: vi.fn(({ input }) => new Promise((resolve) => pending.push({ input, resolve }))),
    },
  };
  const markers = [];
  class FakeMarker { constructor(options) { markers.push(options); } }
  vi.stubGlobal("google", {
    maps: {
      places: suggestionApi,
      importLibrary: vi.fn(async () => suggestionApi),
      Map: class {},
      Marker: FakeMarker,
      Polyline: class {},
      LatLngBounds: class { extend() {} fitBounds() {} },
    },
  });
  return { pending, prediction, place, suggestionApi, markers };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("new Places address suggestions", () => {
  it("debounces and ignores a stale response before accepting a selected place", async () => {
    const { pending, prediction, place, suggestionApi, markers } = installMocks();
    render(<Page />);
    await screen.findByRole("heading", { name: "Local demo account" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "rider_test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rider-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/Loading Google Maps configuration/)).not.toBeInTheDocument());
    const origin = screen.getByDisplayValue("Home");
    fireEvent.change(origin, { target: { value: "PES" } });
    await waitFor(() => expect(suggestionApi.AutocompleteSuggestion.fetchAutocompleteSuggestions).toHaveBeenCalledTimes(1));
    fireEvent.change(origin, { target: { value: "PES University" } });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending.map(({ input }) => input)).toEqual(["PES", "PES University"]);
    pending[0].resolve({ suggestions: [{ placePrediction: { ...prediction, text: { toString: () => "Stale PES" } } }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button", { name: /Stale PES/ })).not.toBeInTheDocument();
    pending[1].resolve({ suggestions: [{ placePrediction: prediction }] });
    expect(await screen.findByRole("button", { name: /PES University, Bengaluru/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /PES University, Bengaluru/ }));
    await waitFor(() => expect(screen.getByDisplayValue("PES University, Bengaluru, Karnataka, India")).toBeInTheDocument());
    expect(place.fetchFields).toHaveBeenCalledWith({ fields: ["displayName", "formattedAddress", "location"] });
    await waitFor(() => expect(markers.some(({ position }) => position?.lat === 12.9352 && position?.lng === 77.5347)).toBe(true));
  });

  it("does not commit fields after the input is edited during selection", async () => {
    const { pending, prediction, place } = installMocks();
    let resolveFields;
    place.fetchFields.mockImplementation(() => new Promise((resolve) => { resolveFields = resolve; }));
    render(<Page />);
    await screen.findByRole("heading", { name: "Local demo account" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "rider_test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "rider-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByDisplayValue("Home")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/Loading Google Maps configuration/)).not.toBeInTheDocument());
    const origin = screen.getByDisplayValue("Home");
    fireEvent.change(origin, { target: { value: "PES University" } });
    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve({ suggestions: [{ placePrediction: prediction }] });
    fireEvent.click(await screen.findByRole("button", { name: /PES University, Bengaluru/ }));
    fireEvent.change(origin, { target: { value: "X" } });
    resolveFields();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByDisplayValue("X")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("PES University, Bengaluru, Karnataka, India")).not.toBeInTheDocument();
    expect(screen.queryByText("Searching Google Places…")).not.toBeInTheDocument();
  });
});
