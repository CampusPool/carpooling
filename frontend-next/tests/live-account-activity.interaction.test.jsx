import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveAccountActivity from "../components/LiveAccountActivity";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const requests = [];
let wallet, waitlist, failWallet, failReadOnce, rejectWaitlistQuoteOnce;
const refreshed = vi.fn(async () => {});
beforeEach(() => {
  requests.length = 0;
  refreshed.mockClear();
  wallet = { available_minor: 25000, held_minor: 500, pending_release_minor: 1000, entries: [] };
  waitlist = [{ id: 41, trip_id: 12, status: "pending", actionable: true }];
  failWallet = false;
  failReadOnce = false;
  rejectWaitlistQuoteOnce = false;
  vi.stubGlobal("fetch", vi.fn(async (url, init = {}) => {
    const path = String(url), method = init.method || "GET", body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ path, method, body, key: new Headers(init.headers).get("Idempotency-Key") });
    if (path.endsWith("/wallet") && method === "GET") return failWallet ? json({ error: { message: "down" } }, 503) : json(wallet);
    if (path.endsWith("/waitlist") && method === "GET") return json({ data: waitlist });
    if (path.endsWith("/wallet/top-up") && method === "POST") { wallet = { ...wallet, available_minor: wallet.available_minor + body.amount_minor }; return json(wallet); }
    if (path.endsWith("/notifications/3/read") && method === "POST") {
      if (failReadOnce) { failReadOnce = false; return json({ error: { message: "network retriable" } }, 503); }
      return json({ data: { id: 3, read_at: "2026-11-09T00:00:00Z" } });
    }
    if (path.endsWith("/waitlist/41/refresh") && method === "POST") return json({ data: { quote_token: "fresh-41", terms: { pickup_label: "Pickup", dropoff_label: "Campus", access_meters: 120, egress_meters: 50, fare_minor: 1500, pickup_at: "2026-12-05T04:00:00Z" } } });
    if (path.endsWith("/waitlist/41/request") && method === "POST") {
      if (rejectWaitlistQuoteOnce) { rejectWaitlistQuoteOnce = false; return json({ error: { code: "COMMUTE_QUOTE_CHANGED" } }, 409); }
      if (body.quote_token !== "fresh-41" || body.consent !== true) throw Error("invalid consent");
      waitlist = [{ ...waitlist[0], status: "requested", actionable: false }];
      return json({ data: { booking_id: 700 } });
    }
    if (path.endsWith("/waitlist/41/cancel") && method === "POST") { waitlist = []; return json({ data: { status: "cancelled" } }); }
    throw Error(`Unknown API ${method} ${path}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount(role = "rider") {
  return render(<LiveAccountActivity token="synthetic-account-token" role={role} notifications={[{ id: 3, title: "Seat accepted", body: "A driver accepted your request", created_at: "2026-11-09T01:00:00Z" }]} unreadCount={1} onRefresh={refreshed} />);
}

describe("unified local account activity", () => {
  it("shows role-scoped wallet and notification actions without a duplicate booking planner", async () => {
    mount("driver");
    expect(screen.queryByText(/Seat waitlist/)).not.toBeInTheDocument();
    expect(screen.queryByText("Find rides")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Demo wallet · ₹250\.00/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Demo wallet · ₹250\.00/));
    expect(screen.getByText(/₹5\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add 500 demo credits" }));
    await waitFor(() => expect(screen.getByText(/Demo wallet · ₹750\.00/)).toBeInTheDocument());
    expect(requests.some(r => r.path.endsWith("wallet/top-up") && r.body.amount_minor === 50000 && r.key)).toBe(true);
    fireEvent.click(screen.getByText(/Notifications · 1 unread/));
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(refreshed).toHaveBeenCalled());
  });

  it("requires fresh waitlist terms and explicit rider consent, then allows cancelling the requested seat", async () => {
    mount();
    await waitFor(() => expect(screen.getByText(/Seat waitlist · 1 active/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Seat waitlist · 1 active/));
    expect(screen.queryByRole("button", { name: "Request seat for driver review" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh eligibility and terms" }));
    const requestButton = await screen.findByRole("button", { name: "Request seat for driver review" });
    expect(requestButton).toBeDisabled();
    expect(screen.getByText(/Access walk 120 m/)).toBeInTheDocument();
    expect(screen.getByText(/Fare ₹15\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the refreshed pickup/ }));
    fireEvent.click(requestButton);
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/waitlist/41/request") && r.body.quote_token === "fresh-41" && r.body.consent === true)).toBe(true));
    expect(await screen.findByText(/Seat requested; waiting for driver review/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel seat request" }));
    await waitFor(() => expect(screen.getByText("No active waitlist requests.")).toBeInTheDocument());
  });

  it("discards an expired waitlist quote and consent after a server conflict, enabling a fresh review", async () => {
    rejectWaitlistQuoteOnce = true;
    mount();
    await waitFor(() => expect(screen.getByText(/Seat waitlist · 1 active/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Seat waitlist · 1 active/));
    fireEvent.click(screen.getByRole("button", { name: "Refresh eligibility and terms" }));
    const requestButton = await screen.findByRole("button", { name: "Request seat for driver review" });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the refreshed pickup/ }));
    fireEvent.click(requestButton);
    expect(await screen.findByText(/Seat terms or eligibility changed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request seat for driver review" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh eligibility and terms" }));
    const fresh = await screen.findByRole("button", { name: "Request seat for driver review" });
    expect(fresh).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the refreshed pickup/ }));
    fireEvent.click(fresh);
    expect(await screen.findByText(/Seat requested; waiting for driver review/)).toBeInTheDocument();
    expect(requests.filter(r => r.path.endsWith("/waitlist/41/request")).length).toBe(2);
  });

  it("does not replace fresh account data with a slower stale refresh", async () => {
    let releaseOld;
    const originalFetch = globalThis.fetch;
    let delayed = false;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      if (String(url).endsWith("/wallet") && !delayed) {
        delayed = true;
        return new Promise(resolve => { releaseOld = () => resolve(json({ available_minor: 100, entries: [] })); });
      }
      return originalFetch(url, init);
    }));
    mount("driver");
    await waitFor(() => expect(releaseOld).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh account" }));
    await waitFor(() => expect(screen.getByText(/Demo wallet · ₹250\.00/)).toBeInTheDocument());
    releaseOld();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.getByText(/Demo wallet · ₹250\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/Demo wallet · ₹1\.00/)).not.toBeInTheDocument();
  });

  it("retains wallet values when refresh fails and preserves idempotency on retry", async () => {
    mount();
    await waitFor(() => expect(screen.getByText(/Demo wallet · ₹250\.00/)).toBeInTheDocument());
    failWallet = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh account" }));
    await waitFor(() => expect(screen.getByText(/Wallet is temporarily unavailable/)).toBeInTheDocument());
    expect(screen.getByText(/Demo wallet · ₹250\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Notifications · 1 unread/));
    failReadOnce = true;
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(screen.getByText("network retriable")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(requests.filter(r => r.path.endsWith("/notifications/3/read")).length).toBe(2));
    const calls = requests.filter(r => r.path.endsWith("/notifications/3/read"));
    expect(calls[0].key).toBeTruthy();
    expect(calls[0].key).toBe(calls[1].key);
  });
});
