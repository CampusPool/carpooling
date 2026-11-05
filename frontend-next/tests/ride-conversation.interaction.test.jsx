import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RideConversation from "../components/RideConversation";
const json = (data, status = 200) => new Response(JSON.stringify({ data }), { status });
const chat = { messages: [], participants: [{ id: 4, name: "Gaia" }], can_send: true };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("confirmed ride conversation", () => {
  it("loads messages and sends text with a retry-safe idempotency key", async () => {
    const keys = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      if (url.endsWith("/tracking")) return json({ location: null, stale: true });
      if (url.endsWith("/messages") && options.method === "POST") {
        keys.push(options.headers["Idempotency-Key"]);
        if (keys.length === 1) return new Response(JSON.stringify({ message: "Temporary failure" }), { status: 503 });
        return json({ id: 7, user_id: 4, text: "Meet at the gate", created_at: new Date().toISOString() });
      }
      return json(chat);
    }));
    render(<RideConversation token="test-token" tripId={9} isDriver={false} />);
    const field = await screen.findByLabelText("Message");
    await waitFor(() => expect(field).toBeEnabled());
    fireEvent.change(field, { target: { value: "Meet at the gate" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Temporary failure");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Meet at the gate")).toBeVisible();
    expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]);
    expect(screen.queryByRole("button", { name: "Share my live location" })).not.toBeInTheDocument();
  });
  it("never starts GPS before driver consent and stops capture and server sharing", async () => {
    let success;
    const clearWatch = vi.fn();
    const watchPosition = vi.fn((callback) => { success = callback; return 31; });
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch } });
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      calls.push({ url, body: options.body && JSON.parse(options.body) });
      if (url.endsWith("/tracking/session")) return json({ session_id: "session-test", active: true });
      if (url.endsWith("/tracking/stop")) return json({ stopped: true });
      if (url.endsWith("/tracking/locations")) return json({ accepted: true });
      if (url.endsWith("/tracking")) return json({ location: null, stale: true });
      return json(chat);
    }));
    render(<RideConversation token="test-token" tripId={9} isDriver />);
    expect(watchPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share my live location" }));
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    await success({ timestamp: Date.now(), coords: { latitude: 12.97, longitude: 77.59, accuracy: 25 } });
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/tracking/locations") && call.body.sequence === 1)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing location" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/tracking/stop") && call.body.session_id === "session-test")).toBe(true));
    expect(clearWatch).toHaveBeenCalledWith(31);
  });
  it("disables messaging when access is denied", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "CHAT_FORBIDDEN" } }), { status: 403 })));
    render(<RideConversation token="test-token" tripId={10} isDriver={false} />);
    await screen.findAllByText("CHAT FORBIDDEN");
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
  it("recreates the map when stale location disappears and a fresh sample returns", async () => {
    vi.useFakeTimers();
    const maps = [];
    const removeMarker = vi.fn();
    vi.stubGlobal("google", { maps: {
      Map: function (element) { maps.push(element); this.panTo = vi.fn(); },
      Marker: function () { this.setMap = removeMarker; this.setPosition = vi.fn(); },
    } });
    let reads = 0;
    const location = { lat: 12.97, lng: 77.59, accuracy_meters: 20, recorded_at: new Date().toISOString() };
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.endsWith("/tracking")) { reads++; return json({ location: reads === 2 ? null : location }); }
      return json(chat);
    }));
    render(<RideConversation token="test-token" tripId={9} isDriver={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(maps).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.queryByLabelText("Driver location on Google Maps")).not.toBeInTheDocument();
    expect(removeMarker).toHaveBeenCalledWith(null);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(maps).toHaveLength(2);
    expect(maps[1]).not.toBe(maps[0]);
  });

});
