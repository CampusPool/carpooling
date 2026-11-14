import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AddressPlacePicker from "../components/AddressPlacePicker";
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MAP_PROVIDER", "ola"));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("resolves student addresses via authenticated Ola and clears coordinates on edit", async () => {
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    requests.push([String(url), init.headers.authorization]);
    const body = String(url).includes("autocomplete")
      ? { predictions: [{ placeId: "place:123", description: "PES University" }] }
      : { place: { label: "PES Main Gate", lat: 12.9345, lng: 77.5348 } };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  const chosen = vi.fn();
  function Picker() {
    const [value, setValue] = useState();
    return <AddressPlacePicker label="Pickup" token="synthetic-session" ready value={value} onChange={p => { chosen(p); setValue(p); }} />;
  }
  render(<Picker />);
  const input = screen.getByRole("combobox", { name: "Pickup" });
  fireEvent.change(input, { target: { value: "PES University" } });
  fireEvent.click(await screen.findByRole("option", { name: "PES University" }));
  await waitFor(() => expect(chosen).toHaveBeenLastCalledWith({ label: "PES Main Gate", lat: 12.9345, lng: 77.5348 }));
  expect(requests).toHaveLength(2);
  expect(requests.every(([url, auth]) => url.startsWith("/api/ola/") && auth === "Bearer synthetic-session")).toBe(true);
  fireEvent.change(input, { target: { value: "Other address" } });
  expect(chosen).toHaveBeenLastCalledWith(undefined);
});
