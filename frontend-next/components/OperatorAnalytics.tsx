"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./OperatorAnalytics.module.css";

type Summary = { rides: number; planned: number; in_progress: number; completed: number; cancelled: number; total_seats: number; accepted_seats: number; pending_requests: number; declined_requests: number; cancelled_requests: number; over_capacity_rides: number };
type Daily = { day: string; rides: number; accepted_seats: number; pending_requests: number; cancelled_requests: number; utilization_pct: number; rides_7d_average: number };
type Ride = { trip_id: number; service_day: string; departure_at: string; state: string; total_seats: number; accepted_seats: number; available_seats: number; pending_requests: number; declined_requests: number; cancelled_requests: number; utilization_pct: number; capacity_alert: boolean };
type Audit = { event_id: number; trip_id: number; booking_id: number | null; previous_state: number | null; next_state: number; occurred_at: string };
type Report = {
  audience: "operator"; scope: "local_published_rides"; timezone: "Asia/Kolkata";
  window: { days: number; from: string; to: string };
  sql: { summary: Summary; daily: Daily[]; rides: Ride[]; audit: Audit[]; limits: { rides: number; audit: number }; truncated: boolean };
  activity: { status: "ready" | "stale" | "unavailable" | "disabled"; last_synced_at: string | null; lag_seconds: number | null; daily: { day: string; action: string; eventCount: number; uniqueTripCount: number }[]; message?: string };
};
type Load = { token: string; days: number; attempt: number; report?: Report; error?: string };
const requestStates = ["Pending", "Accepted", "Declined", "Cancelled"];
const lifecycleStates: Record<string, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
const actions: Record<string, string> = { arrive: "Arrivals", start: "Starts", board: "Boardings", alight: "Drop-offs", complete: "Completions", cancel: "Cancellations" };
const percentage = (value: number) => `${Number(value).toFixed(1)}%`;
const timestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
};
const limit = (value: number, maximum: number) => Number.isInteger(value) && value > 0 ? Math.min(value, maximum) : maximum;

export default function OperatorAnalytics({ token }: { token: string }) {
  const [days, setDays] = useState(7);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const generation = useRef(0);
  const heading = useId();
  const selector = useId();
  // Key the displayed result as well as the request: an account change must hide
  // the previous operator's report even before the next effect runs.
  const current = load?.token === token && load.days === days && load.attempt === attempt ? load : null;
  const report = current?.report;
  const loading = !current;

  useEffect(() => {
    const request = ++generation.current;
    const controller = new AbortController();
    let active = true;
    async function refresh() {
      try {
        if (!token) throw new Error("Sign in to view operations reports.");
        const response = await fetch(`/api/mobility/operator/analytics?days=${days}`, {
          method: "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? "Operations reports require an active operator account with a configured college."
          : "Operations reports could not be loaded. Please retry.");
        const body = await response.json();
        const result: Report = body.data ?? body;
        if (result.audience !== "operator" || result.scope !== "local_published_rides" || result.timezone !== "Asia/Kolkata"
          || result.window?.days !== days || !result.sql?.summary || !result.sql?.limits
          || !Array.isArray(result.sql.daily) || !Array.isArray(result.sql.rides) || !Array.isArray(result.sql.audit)
          || !result.activity || !["ready", "stale", "unavailable", "disabled"].includes(result.activity.status) || !Array.isArray(result.activity.daily)) {
          throw new Error("Operations reports could not be read. Please retry.");
        }
        if (active && generation.current === request) setLoad({ token, days, attempt, report: result });
      } catch (error) {
        if (active && generation.current === request) setLoad({ token, days, attempt, error: error instanceof Error && [
          "Sign in to view operations reports.",
          "Operations reports require an active operator account with a configured college.",
          "Operations reports could not be loaded. Please retry.",
          "Operations reports could not be read. Please retry.",
        ].includes(error.message) ? error.message : "Operations reports could not be loaded. Please retry." });
      }
    }
    void refresh();
    return () => { active = false; generation.current++; controller.abort(); };
  }, [token, days, attempt]);

  const summary = report?.sql.summary;
  const ridesLimit = limit(report?.sql.limits.rides ?? 100, 100);
  const auditLimit = limit(report?.sql.limits.audit ?? 20, 20);
  const rides = report?.sql.rides.slice(0, ridesLimit) ?? [];
  const audit = report?.sql.audit.slice(0, auditLimit) ?? [];
  const activity = report?.activity;
  const hasActivity = activity?.status === "ready" || activity?.status === "stale";

  return <section className={styles.panel} aria-labelledby={heading} aria-busy={loading}>
    <div className={styles.header}>
      <div><small>COLLEGE OPERATIONS</small><h2 id={heading}>Ride operations reports</h2></div>
      <div className={styles.controls}>
        <label htmlFor={selector}>Report period<select id={selector} value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[7, 14, 31].map((value) => <option value={value} key={value}>Last {value} days</option>)}
        </select></label>
        <button type="button" disabled={loading} onClick={() => setAttempt((value) => value + 1)}>{current?.error ? "Retry report" : "Refresh report"}</button>
      </div>
    </div>
    <p className={styles.fine}>Local published ride parties in your configured college, including historical rides from suspended accounts. Current publications offer one seat per ride party; these totals do not measure occupancy along a route.</p>
    {loading && <p role="status">Loading operations reports…</p>}
    {current?.error && <p role="alert">{current.error}</p>}
    {report && summary && <>
      <p className={styles.window}><time dateTime={report.window.from}>{report.window.from}</time> – <time dateTime={report.window.to}>{report.window.to}</time> · Inclusive calendar days · Asia/Kolkata (IST)</p>
      {summary.rides === 0 && <p className={styles.notice}>No local published rides in this period.</p>}
      <dl className={styles.metrics}>
        {([["Published rides", summary.rides], ["Offered seats", summary.total_seats], ["Accepted seats", summary.accepted_seats], ["Pending requests", summary.pending_requests], ["Completed rides", summary.completed], ["Capacity alerts", summary.over_capacity_rides]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className={styles.fine}>Ride states: {summary.planned} planned · {summary.in_progress} in progress · {summary.completed} completed · {summary.cancelled} cancelled. Request decisions: {summary.declined_requests} declined · {summary.cancelled_requests} cancelled.</p>
      <h3>Daily scheduled rides</h3>
      {!report.sql.daily.length ? <p>No daily ride records in this period.</p> : <div className={styles.tableWrap} role="region" aria-label="Daily scheduled rides table" tabIndex={0}><table>
        <caption>Scheduled service dates · 7-day average includes the preceding six calendar days</caption>
        <thead><tr><th scope="col">Day (IST)</th><th scope="col">Rides</th><th scope="col">Accepted seats</th><th scope="col">Pending</th><th scope="col">Cancelled requests</th><th scope="col">Seat utilization</th><th scope="col">7-day ride average</th></tr></thead>
        <tbody>{report.sql.daily.slice(0, 31).map((row) => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.rides}</td><td>{row.accepted_seats}</td><td>{row.pending_requests}</td><td>{row.cancelled_requests}</td><td>{percentage(row.utilization_pct)}</td><td>{Number(row.rides_7d_average).toFixed(2)}</td></tr>)}</tbody>
      </table></div>}
      <h3>Published ride capacity</h3>
      <p className={styles.fine}>Showing {rides.length} rides · Maximum {ridesLimit}. Available seats are for the whole ride party.</p>
      {report.sql.truncated && <p className={styles.notice}>Partial detail: ride or decision rows exceed the report limits. Summary and daily totals cover the full period.</p>}
      {!rides.length ? <p>No ride details in this period.</p> : <div className={styles.tableWrap} role="region" aria-label="Published ride capacity table" tabIndex={0}><table>
        <caption>Ride details · bounded to {ridesLimit} rows</caption>
        <thead><tr><th scope="col">Ride</th><th scope="col">Departure (IST)</th><th scope="col">State</th><th scope="col">Offered seats</th><th scope="col">Accepted</th><th scope="col">Available</th><th scope="col">Pending</th><th scope="col">Declined</th><th scope="col">Cancelled requests</th><th scope="col">Utilization</th><th scope="col">Capacity check</th></tr></thead>
        <tbody>{rides.map((row) => <tr key={row.trip_id}><th scope="row">#{row.trip_id}</th><td><time dateTime={row.departure_at}>{timestamp(row.departure_at)}</time></td><td>{lifecycleStates[row.state] ?? "Unknown"}</td><td>{row.total_seats}</td><td>{row.accepted_seats}</td><td>{row.available_seats}</td><td>{row.pending_requests}</td><td>{row.declined_requests}</td><td>{row.cancelled_requests}</td><td>{percentage(row.utilization_pct)}</td><td>{row.capacity_alert ? <strong className={styles.warning}>Over capacity</strong> : "Within capacity"}</td></tr>)}</tbody>
      </table></div>}
      <h3>Booking decision audit</h3>
      <p className={styles.fine}>Showing {audit.length} decisions · Maximum {auditLimit}. Request history records state changes; it does not count unique passengers.</p>
      {!audit.length ? <p>No booking decisions recorded in this period.</p> : <div className={styles.tableWrap} role="region" aria-label="Booking decision audit table" tabIndex={0}><table>
        <caption>Latest booking state changes · bounded to {auditLimit} rows</caption>
        <thead><tr><th scope="col">Time (IST)</th><th scope="col">Ride</th><th scope="col">Booking</th><th scope="col">Previous decision</th><th scope="col">New decision</th></tr></thead>
        <tbody>{audit.map((row) => <tr key={row.event_id}><td><time dateTime={row.occurred_at}>{timestamp(row.occurred_at)}</time></td><td>#{row.trip_id}</td><td>{row.booking_id === null ? "Deleted booking" : `#${row.booking_id}`}</td><td>{row.previous_state === null ? "Created" : requestStates[row.previous_state] ?? "Unknown"}</td><td>{requestStates[row.next_state] ?? "Unknown"}</td></tr>)}</tbody>
      </table></div>}
      <h3>Lifecycle event trends</h3>
      <p className={styles.fine}>Event history is synchronized separately from booking totals. Event counts and distinct rides measure different things.</p>
      <p className={activity?.status === "ready" ? styles.fine : styles.notice} role="status">
        {activity?.status === "ready" && "Event trends are up to date."}
        {activity?.status === "stale" && "Event trends are stale. Displayed counts reflect the last successful sync and may be incomplete."}
        {activity?.status === "unavailable" && "Event trends are unavailable. Booking and capacity reports remain available; missing activity is not zero activity."}
        {activity?.status === "disabled" && "Event trends are disabled. Booking and capacity reports remain available; activity counts are not available."}
      </p>
      <p className={styles.fine}>Last successful event sync: {activity?.last_synced_at ? <time dateTime={activity.last_synced_at}>{timestamp(activity.last_synced_at)} IST</time> : "Not available"}{activity?.lag_seconds != null && ` · Reported sync lag: ${activity.lag_seconds} seconds`}</p>
      {hasActivity && (!activity?.daily.length ? <p>{activity?.status === "ready" ? "No lifecycle events recorded in this period." : "No event rows available from the last successful sync; activity may be incomplete."}</p> : <div className={styles.tableWrap} role="region" aria-label="Lifecycle event trends table" tabIndex={0}><table>
        <caption>Lifecycle events by day and action{activity.status === "stale" ? " · Stale snapshot" : ""}</caption>
        <thead><tr><th scope="col">Day (IST)</th><th scope="col">Action</th><th scope="col">Events</th><th scope="col">Distinct rides</th></tr></thead>
        <tbody>{activity.daily.slice(0, 31 * 6).map((row) => <tr key={`${row.day}-${row.action}`}><th scope="row">{row.day}</th><td>{actions[row.action] ?? "Other lifecycle event"}</td><td>{row.eventCount}</td><td>{row.uniqueTripCount}</td></tr>)}</tbody>
      </table></div>)}
    </>}
  </section>;
}
