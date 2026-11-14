import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CanonicalPlacePicker from "../components/CanonicalPlacePicker";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_MAP_PROVIDER", "ola"); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Ola CanonicalPool approved-stop picker", () => {
  it("uses authenticated Ola proxy without Google and requires explicit approved-stop selection", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.authorization });
      if (String(url).startsWith("/api/ola/autocomplete?")) {
        return json({ predictions: [{ placeId: "ola-platform:12345", description: "PES University Bengaluru" }] });
      }
      if (String(url).startsWith("/api/ola/details?")) {
        return json({ place: { lat: 12.9345, lng: 77.5348, label: "PES University Main Gate" } });
      }
      throw Error("Unexpected Google or third-party request");
    }));
    render(<CanonicalPlacePicker label="Pickup point" name="pickup_point_id" token="synthetic-campus-session"
      points={[{ id: 7, name: "Approved Gate", lat: 12.9350, lng: 77.5350 }]} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "PES University" } });
    fireEvent.click(await screen.findByRole("button", { name: "PES University Bengaluru" }));
    expect(await screen.findByRole("button", { name: /Approved Gate/ })).toBeInTheDocument();
    // Resolving a third-party address never automatically fills a catalog stop.
    expect(screen.getByRole("combobox", { name: "Pickup point" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Approved Gate/ }));
    expect(screen.getByRole("combobox", { name: "Pickup point" })).toHaveValue("7");
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.url.startsWith("/api/ola/") && call.authorization === "Bearer synthetic-campus-session")).toBe(true);
    expect(calls[1].url).toContain("ola-platform%3A12345");
  });

  it("shows a meaningful provider limit without retrying or changing the approved stop", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "OLA_QUOTA_OR_RATE_LIMIT" } }, 429)));
    render(<CanonicalPlacePicker label="Pickup point" name="pickup_point_id" token="synthetic-campus-session"
      points={[{ id: 7, name: "Approved Gate", lat: 12.9350, lng: 77.5350 }]} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "PES University" } });
    expect(await screen.findByRole("status")).toHaveTextContent(/Address search is unavailable/);
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Pickup point" }), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Pickup point" })).toHaveValue("7"));
  });
});
