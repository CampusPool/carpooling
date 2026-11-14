import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("shows chat timestamps in India Standard Time, independently of the host timezone", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => url.endsWith("/tracking")
      ? json({ location: null, stale: true })
      : json({ messages: [{ id: 7, user_id: 4, text: "Leaving now", created_at: "2026-11-09T08:04:00Z" }], participants: [{ id: 4, name: "Gaia" }], can_send: true })));
    render(<RideConversation token="test-token" tripId={9} isDriver={false} />);
    expect(await screen.findByText("Leaving now")).toBeVisible();
    expect(screen.getByText(/01:34 pm/i)).toBeInTheDocument();
  });
  it("keeps chat available without requesting or sharing live location", async () => {
    const watchPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { watchPosition } });
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async url => { calls.push(String(url)); return json(chat); }));
    render(<RideConversation token="test-token" tripId={9} isDriver />);
    expect(await screen.findByLabelText("Message")).toBeEnabled();
    expect(screen.queryByText("Driver location")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share my live location" })).not.toBeInTheDocument();
    expect(calls.every(url => !url.includes("/tracking"))).toBe(true);
    expect(watchPosition).not.toHaveBeenCalled();
  });
  it("disables messaging when access is denied", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "CHAT_FORBIDDEN" } }), { status: 403 })));
    render(<RideConversation token="test-token" tripId={10} isDriver={false} />);
    await screen.findAllByText("CHAT FORBIDDEN");
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
