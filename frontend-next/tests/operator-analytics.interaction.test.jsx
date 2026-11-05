import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OperatorAnalytics from "../components/OperatorAnalytics";

// Public GET /api/mobility/operator/analytics contract; no passenger payloads.
const report = (days = 7) => ({
  audience: "operator", scope: "local_published_rides", timezone: "Asia/Kolkata",
  window: { days, from: "2026-10-30", to: "2026-11-05" },
  sql: {
    summary: { rides: 3, planned: 1, in_progress: 0, completed: 1, cancelled: 1, total_seats: 3, accepted_seats: 2, pending_requests: 1, declined_requests: 1, cancelled_requests: 1, over_capacity_rides: 1 },
    daily: [{ day: "2026-11-05", rides: 3, accepted_seats: 2, pending_requests: 1, cancelled_requests: 1, utilization_pct: 66.6667, rides_7d_average: 0.4286 }],
    rides: [{ trip_id: 73, service_day: "2026-11-05", departure_at: "2026-11-05T08:00:00+05:30", state: "completed", total_seats: 1, accepted_seats: 2, available_seats: 0, pending_requests: 1, declined_requests: 1, cancelled_requests: 1, utilization_pct: 200, capacity_alert: true }],
    audit: [
      { event_id: 5, trip_id: 73, booking_id: 64, previous_state: null, next_state: 0, occurred_at: "2026-11-05T01:00:00Z" },
      { event_id: 6, trip_id: 73, booking_id: 64, previous_state: 0, next_state: 1, occurred_at: "2026-11-05T01:01:00Z" },
      { event_id: 7, trip_id: 73, booking_id: 65, previous_state: 0, next_state: 2, occurred_at: "2026-11-05T01:02:00Z" },
      { event_id: 8, trip_id: 73, booking_id: 66, previous_state: 1, next_state: 3, occurred_at: "2026-11-05T01:03:00Z" },
    ],
    limits: { rides: 100, audit: 20 }, truncated: false,
  },
  activity: { status: "ready", last_synced_at: "2026-11-05T02:00:00Z", lag_seconds: 15, daily: [{ day: "2026-11-05", action: "start", eventCount: 2, uniqueTripCount: 1 }] },
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("private operator analytics", () => {
  it("requests the real contract and displays seat, daily, decision and lifecycle reports", async () => {
    const fetch = vi.fn(async () => json(report()));
    vi.stubGlobal("fetch", fetch);
    render(<OperatorAnalytics token="operator-token" />);
    await screen.findByText("Over capacity");
    expect(fetch).toHaveBeenCalledWith("/api/mobility/operator/analytics?days=7", expect.objectContaining({ method: "GET", cache: "no-store", headers: { Authorization: "Bearer operator-token" }, signal: expect.any(AbortSignal) }));
    expect(screen.getByText("Offered seats", { selector: "dt" }).nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Accepted seats", { selector: "dt" }).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Completed rides").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("66.7%")).toBeVisible();
    expect(screen.getByText("0.43")).toBeVisible();
    const audit = within(screen.getByRole("region", { name: "Booking decision audit table" }));
    for (const state of ["Created", "Pending", "Accepted", "Declined", "Cancelled"]) expect(audit.getAllByText(state).length).toBeGreaterThan(0);
    expect(screen.getByText("Starts")).toBeVisible();
    expect(screen.getByText(/Last successful event sync:/)).toHaveTextContent("5 Nov 2026");
    expect(screen.getByText(/Inclusive calendar days/)).toHaveTextContent("Asia/Kolkata (IST)");
    expect(screen.getByText(/Current publications offer one seat/)).toBeVisible();
  });

  it("uses the chosen date query and ignores older, out-of-order window responses", async () => {
    const old = deferred(); const latest = deferred();
    const fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    vi.stubGlobal("fetch", fetch);
    render(<OperatorAnalytics token="operator-token" />);
    fireEvent.change(screen.getByLabelText("Report period"), { target: { value: "14" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1][0]).toBe("/api/mobility/operator/analytics?days=14");
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    const newest = report(14); newest.sql.summary.total_seats = 14;
    await act(async () => latest.resolve(json(newest)));
    expect(screen.getByText("Offered seats", { selector: "dt" }).nextElementSibling).toHaveTextContent(/^14$/);
    await act(async () => old.resolve(json(report())));
    expect(screen.getByText("Offered seats", { selector: "dt" }).nextElementSibling).toHaveTextContent(/^14$/);
    expect(screen.queryByText("Loading operations reports…")).not.toBeInTheDocument();
  });

  it("clears previous account data immediately and rejects a late response after token changes", async () => {
    const old = deferred(); const latest = deferred();
    const fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(<OperatorAnalytics token="old-account" />);
    rerender(<OperatorAnalytics token="new-account" />);
    await act(async () => old.resolve(json(report())));
    expect(screen.queryByText("Offered seats", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    await act(async () => latest.resolve(json(report())));
    expect(screen.getByText("Offered seats", { selector: "dt" })).toBeVisible();
    rerender(<OperatorAnalytics token="third-account" />);
    expect(screen.queryByText("Offered seats", { selector: "dt" })).not.toBeInTheDocument();
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer new-account");
  });

  it("shows a recoverable loading error and retries the same selected period", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ message: "internal private error" }, 503)).mockResolvedValueOnce(json(report()));
    vi.stubGlobal("fetch", fetch);
    render(<OperatorAnalytics token="operator-token" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByRole("alert")).toHaveTextContent("Operations reports could not be loaded");
    expect(screen.queryByText("internal private error")).not.toBeInTheDocument();
    expect(screen.queryByText("Offered seats", { selector: "dt" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry report" }));
    await screen.findByText("Offered seats", { selector: "dt" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["unavailable", "disabled"])("retains SQL data during %s activity without displaying false zero counts", async (status) => {
    const data = report(); data.activity = { status, last_synced_at: null, lag_seconds: null, daily: [{ day: "2026-11-05", action: "start", eventCount: 999, uniqueTripCount: 999 }] };
    vi.stubGlobal("fetch", vi.fn(async () => json(data)));
    render(<OperatorAnalytics token="operator-token" />);
    await screen.findByText("Offered seats", { selector: "dt" });
    expect(screen.getByText("Offered seats", { selector: "dt" }).nextElementSibling).toHaveTextContent("3");
    expect(screen.getByRole("status")).toHaveTextContent(`Event trends are ${status}`);
    expect(screen.getByText(/Last successful event sync:/)).toHaveTextContent("Not available");
    expect(screen.queryByRole("region", { name: "Lifecycle event trends table" })).not.toBeInTheDocument();
    expect(screen.queryByText("No lifecycle events recorded in this period.")).not.toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
  });

  it("labels stale activity and its last successful time, including incomplete empty snapshots", async () => {
    const data = report(); data.activity.status = "stale";
    const fetch = vi.fn().mockResolvedValueOnce(json(data));
    vi.stubGlobal("fetch", fetch);
    render(<OperatorAnalytics token="operator-token" />);
    await screen.findByText("Starts");
    expect(screen.getByRole("status")).toHaveTextContent("stale");
    expect(screen.getByText(/Last successful event sync:/)).toHaveTextContent("5 Nov 2026");
    expect(screen.getByText(/Lifecycle events by day and action/)).toHaveTextContent("Stale snapshot");
    data.activity.daily = [];
    fetch.mockResolvedValueOnce(json(data));
    fireEvent.click(screen.getByRole("button", { name: "Refresh report" }));
    expect(await screen.findByText(/No event rows available from the last successful sync/)).toBeVisible();
    expect(screen.queryByText("No lifecycle events recorded in this period.")).not.toBeInTheDocument();
  });

  it("labels bounded and partial detail separately from full summary totals", async () => {
    const data = report(); data.sql.limits = { rides: 1, audit: 2 }; data.sql.truncated = true;
    data.sql.rides.push({ ...data.sql.rides[0], trip_id: 999 });
    vi.stubGlobal("fetch", vi.fn(async () => json(data)));
    render(<OperatorAnalytics token="operator-token" />);
    expect(await screen.findByText(/Partial detail:/)).toHaveTextContent("Summary and daily totals cover the full period");
    expect(screen.getByText(/Showing 1 rides/)).toHaveTextContent("Maximum 1");
    expect(screen.getByText(/Showing 2 decisions/)).toHaveTextContent("Maximum 2");
    expect(within(screen.getByRole("region", { name: "Published ride capacity table" })).getAllByRole("row")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "Booking decision audit table" })).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText("#999")).not.toBeInTheDocument();
    expect(screen.getByText("Published rides").nextElementSibling).toHaveTextContent("3");
  });

  it("preserves decision history when a booking reference has been deleted", async () => {
    const data = report(); data.sql.audit[0].booking_id = null;
    vi.stubGlobal("fetch", vi.fn(async () => json(data)));
    render(<OperatorAnalytics token="operator-token" />);
    expect(await screen.findByText("Deleted booking")).toBeVisible();
    expect(screen.getByText(/7-day average includes the preceding six calendar days/)).toBeVisible();
  });

  it("offers 31 days and renders genuine empty reports explicitly", async () => {
    const data = report(31);
    Object.keys(data.sql.summary).forEach((key) => { data.sql.summary[key] = 0; });
    data.sql.daily = []; data.sql.rides = []; data.sql.audit = []; data.activity.daily = [];
    const fetch = vi.fn(async (url) => json(url.endsWith("days=31") ? data : report()));
    vi.stubGlobal("fetch", fetch);
    render(<OperatorAnalytics token="operator-token" />);
    fireEvent.change(screen.getByLabelText("Report period"), { target: { value: "31" } });
    expect(await screen.findByText("No local published rides in this period.")).toBeVisible();
    expect(screen.getByText("No lifecycle events recorded in this period.")).toBeVisible();
    expect(fetch.mock.calls.at(-1)[0]).toBe("/api/mobility/operator/analytics?days=31");
  });

  it("aborts an unmounted request and rejects mismatched contract windows", async () => {
    const pending = deferred();
    const fetch = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(json(report(14)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<OperatorAnalytics token="operator-token" />);
    view.unmount();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => pending.resolve(json(report())));
    render(<OperatorAnalytics token="operator-token" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be read");
    expect(screen.queryByText("Offered seats", { selector: "dt" })).not.toBeInTheDocument();
  });
});
