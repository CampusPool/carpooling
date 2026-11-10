import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { decodeOlaPolyline, olaAutocomplete, olaDetails, olaDirections } from "../lib/ola-client";
import OlaPlaceInput from "../components/OlaPlaceInput";
import { validatedOlaPlaceId } from "../lib/ola-server";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Ola-only campus routing client", () => {
  it("accepts real Ola namespace-prefixed place IDs and rejects injection", () => {
    expect(validatedOlaPlaceId("ola-platform:5000205199247")).toBe(true);
    expect(validatedOlaPlaceId("ola-platform:abc_123-XYZ")).toBe(true);
    for (const id of ["", "abc?api_key=leak", "https://evil.example/", "a b", "../etc/passwd", "x".repeat(161)]) {
      expect(validatedOlaPlaceId(id)).toBe(false);
    }
  });
  it("decodes standard polyline into longitude-latitude map coordinates", () => {
    const points = decodeOlaPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  });

  it("rejects truncated, empty and nonsensical geometry", () => {
    for (const geometry of ["", "?", "bad", "!"]) {
      expect(() => decodeOlaPolyline(geometry)).toThrow();
    }
  });

  it("sends the CampusPool bearer token only to same-origin proxy endpoints", async () => {
    fetch.mockImplementation(async (url, init) => {
      expect(String(url)).toMatch(/^\/api\/ola\//);
      expect(init.headers.authorization).toBe("Bearer synthetic-client-jwt-token");
      if (String(url).includes("autocomplete")) return json({ predictions: [{ placeId: "p1", description: "PES" }] });
      if (String(url).includes("details")) return json({ place: { label: "PES University", lat: 12.9352, lng: 77.5347 } });
      return json({ distanceMeters: 950, durationSeconds: 250, encodedPolyline: "_p~iF~ps|U_ulLnnqC" });
    });
    expect((await olaAutocomplete("PES", "synthetic-client-jwt-token")).predictions).toHaveLength(1);
    expect((await olaDetails("p1", "synthetic-client-jwt-token")).place.label).toBe("PES University");
    expect((await olaDirections([{ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.60 }], "synthetic-client-jwt-token")).durationSeconds).toBe(250);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("converts a 429 response to a clear quota message without retrying", async () => {
    fetch.mockResolvedValue(json({ error: { code: "OLA_QUOTA_OR_RATE_LIMIT" } }, 429));
    await expect(olaAutocomplete("PES", "synthetic-token")).rejects.toThrow(/allowance reached/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("only selects resolved Ola places within the supported Bengaluru region", async () => {
    fetch.mockImplementation(async (url) => String(url).includes("autocomplete")
      ? json({ predictions: [{ placeId: "p1", description: "PES University, Bengaluru" }] })
      : json({ place: { lat: 12.9352, lng: 77.5347, label: "PES University" } }));
    const onChange = vi.fn();
    render(<OlaPlaceInput label="Pickup place" ready token="synthetic-jwt" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Pickup place" }), { target: { value: "PES University" } });
    fireEvent.click(await screen.findByRole("button", { name: /PES University, Bengaluru/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 12.9352, lng: 77.5347, label: "PES University" }));
  });
});
