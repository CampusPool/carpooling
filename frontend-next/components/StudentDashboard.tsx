"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AddressPlace } from "./AddressPlacePicker";
import RideConversation from "./RideConversation";
import { emitUnauthorized } from "../lib/session-events";
import { isFutureCommute, istDateTime } from "../lib/commute-time";
import styles from "./StudentDashboard.module.css";

export type RideDefaults = { origin: AddressPlace; destination: AddressPlace; date: string; time: string };
export type RideSection = "find" | "offer" | "bookings" | "updates";
type Plan = { home: AddressPlace; campus: AddressPlace; outbound_time: string; return_time: string; weekdays: number[]; paused: boolean; outbound_enabled: boolean; return_enabled: boolean };
type Booking = { booking_id: number; trip_id: number; request_state: number; state: string; departure_at: string; driver_name?: string; rider_name?: string; owner?: boolean; can_drive?: boolean; pickup_label?: string; dropoff_label?: string };
type Vehicle = { id?: number; registration: string; name: string; vehicle_type: "car" | "bike"; passenger_seats: number; demo_verified: boolean; description?: string };

async function api(token: string, path: string, body?: object) {
  const response = await fetch(`/api/mobility/address-rides/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized(token);
    throw Error(result.error?.message || result.message || "The request failed. Please try again.");
  }
  return result;
}

const paths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/></>,
  rides: <><path d="M5 17H3v-5l3-6h12l3 6v5h-2M3 12h18M5 17h14"/><path d="M5 17v3m14-3v3M7 14h1m8 0h1"/></>,
  chats: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3-.5l-5 2 1.5-5A8 8 0 1 1 20 11.5ZM8 12h.01M12 12h.01M16 12h.01"/>,
  timetable: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/></>,
  account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  bell: <path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3zm4 10h4"/>,
  check: <path d="m5 12 4 4L19 6"/>,
};
export function DashboardIcon({ name }: { name: string }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const links = [["home", "Home"], ["rides", "Rides"], ["chats", "Chats"], ["timetable", "Timetable"], ["account", "Account"]] as const;
export function DashboardFrame({ view, onNavigate, onUpdates, initials, children }: {
  view: string; onNavigate: (view: string) => void; onUpdates: () => void; initials: string; children: ReactNode;
}) {
  const active = ["account", "settings", "vehicle"].includes(view) ? "account" : view === "plan" ? "home" : view;
  return <div className={styles.shell}>
    <header className={styles.header}>
      <button className={styles.brand} type="button" onClick={() => onNavigate("home")}><span>C</span>CampusPool</button>
      <div className={styles.headerActions}>
        <button type="button" aria-label="Ride notifications" onClick={onUpdates}><DashboardIcon name="bell" /></button>
        <button type="button" className={styles.avatar} aria-label="Your account" onClick={() => onNavigate("account")}>{initials}</button>
      </div>
    </header>
    <div className={styles.layout}>
      {view !== "complete-profile" && <nav className={styles.nav} aria-label="Main navigation">
        {links.map(([key, label]) => <button type="button" key={key} aria-current={active === key ? "page" : undefined} onClick={() => onNavigate(key)}>
          <DashboardIcon name={key} /><span>{label}</span>
        </button>)}
      </nav>}
      <main className={styles.content}>{children}</main>
    </div>
  </div>;
}

function useLoad<T>(token: string, path: string, read: (response: any) => T, refreshMs?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await api(token, path);
        if (active) { setData(read(result)); setError(""); }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Unable to load.");
      } finally { pending = false; }
    }
    void load();
    const interval = refreshMs ? window.setInterval(load, refreshMs) : undefined;
    return () => { active = false; window.clearInterval(interval); };
  }, [token, path, read, retry, refreshMs]);
  return { data, error, reload: () => setRetry(value => value + 1) };
}

const readBookings = (result: { data: Booking[] }) => result.data;
const readPlan = (result: { data: Plan | null }) => result.data;
const readUpdates = (result: { data: { id: number; title: string; body: string }[] }) => result.data;
const formatTime = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" });

export function DashboardHome({ token, name, openRide, openPlan }: { token: string; name: string; openRide: (section: RideSection, defaults?: RideDefaults) => void; openPlan: () => void }) {
  const bookings = useLoad(token, "bookings", readBookings, 20000);
  const plan = useLoad(token, "plan", readPlan);
  const updates = useLoad(token, "notifications", readUpdates, 20000);
  const [offset, setOffset] = useState(0);
  const date = istDateTime(new Date(Date.now() + offset * 86400000)).date;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const planned = plan.data;
  const plannedRows = planned && !planned.paused && planned.weekdays.includes(weekday) ? [
    ...(planned.outbound_enabled ? [{ origin: planned.home, destination: planned.campus, date, time: planned.outbound_time }] : []),
    ...(planned.return_enabled ? [{ origin: planned.campus, destination: planned.home, date, time: planned.return_time }] : []),
  ] : [];
  const upcoming = bookings.data?.filter(booking => [0, 1].includes(booking.request_state) && !["cancelled", "completed"].includes(booking.state)) ?? [];
  return <>
    <section className={styles.hero}>
      <div><p>Campus carpooling</p><h1>Hi, {name.trim().split(/\s+/)[0] || "there"}.</h1><p>Find a ride to campus, or share a seat on your next trip.</p>
        <div className={styles.actions}><button className={styles.heroPrimary} onClick={() => openRide("find")}>Find a ride <DashboardIcon name="arrow" /></button><button className={styles.heroSecondary} onClick={() => openRide("offer")}>Offer a ride</button></div>
      </div><div aria-hidden="true" className={styles.heroArt}><DashboardIcon name="rides" /></div>
    </section>
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <div className={styles.sectionHead}><h2>Planned rides</h2><button className={styles.link} onClick={openPlan}>{planned ? "Edit schedule" : "Set up schedule"}</button></div>
          <div className={styles.dates}>{[0, 1, 2, 3].map(day => <button type="button" key={day} aria-pressed={offset === day} onClick={() => setOffset(day)}>{day === 0 ? "Today" : day === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric" }).format(Date.now() + day * 86400000)}</button>)}</div>
          {plan.error ? <p role="alert">{plan.error} <button className={styles.link} onClick={plan.reload}>Retry</button></p> : plannedRows.length ? plannedRows.map(ride => <article key={ride.origin.label + ride.time} className={styles.routeCard}>
            <strong>{ride.time} IST</strong><div><span>{ride.origin.label}</span><span>{ride.destination.label}</span></div>
            <button className={styles.primary} disabled={!isFutureCommute(date, ride.time)} onClick={() => openRide("find", ride)}>Find rides <DashboardIcon name="arrow" /></button>
          </article>) : <p className={styles.muted}>{planned?.paused ? "Your schedule is paused." : plan.data === undefined ? "Loading your schedule…" : "No planned trips for this day."}</p>}
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionHead}><h2>Upcoming bookings</h2><button className={styles.link} onClick={() => openRide("bookings")}>View bookings</button></div>
          {bookings.error ? <p role="alert">{bookings.error} <button className={styles.link} onClick={bookings.reload}>Retry</button></p> : upcoming.length ? upcoming.slice(0, 4).map(booking => <article key={booking.booking_id} className={styles.activity}><strong>{booking.request_state === 1 ? "Confirmed ride" : "Seat request"}</strong><span>{formatTime(booking.departure_at)} IST</span></article>) : <p className={styles.muted}>{bookings.data ? "Your upcoming bookings will appear here." : "Loading bookings…"}</p>}
        </section>
      </div>
      <section className={styles.panel}>
        <div className={styles.sectionHead}><h2>Ride activity</h2><button className={styles.link} onClick={() => openRide("updates")}>View updates</button></div>
        {updates.error ? <p role="alert">{updates.error} <button className={styles.link} onClick={updates.reload}>Retry</button></p> : updates.data?.length ? updates.data.slice(0, 4).map(item => <article key={item.id} className={styles.activity}><strong>{item.title}</strong><span>{item.body}</span></article>) : <p className={styles.muted}>{updates.data ? "Booking updates will appear here." : "Loading updates…"}</p>}
      </section>
    </div>
  </>;
}

export function DashboardChats({ token, onFind }: { token: string; onFind: () => void }) {
  const { data, error, reload } = useLoad(token, "bookings", readBookings, 15000);
  const [selected, setSelected] = useState<number>();
  const conversations = new Map<number, Booking>();
  for (const booking of data || []) if (booking.request_state === 1 && !["cancelled", "completed"].includes(booking.state)) conversations.set(booking.trip_id, booking);
  const current = selected === undefined ? undefined : conversations.get(selected);
  return <section className={styles.panel}>
    {error && <p role="alert">{error} <button className={styles.link} onClick={reload}>Retry</button></p>}
    {!data && !error && <p role="status">Loading chats…</p>}
    {data && conversations.size === 0 && <div className={styles.empty}><DashboardIcon name="chats" /><h2>No active conversations</h2><p>Chat with the driver or rider once a booking is confirmed.</p><button className={styles.primary} onClick={onFind}>Find a ride</button></div>}
    {conversations.size > 0 && <div className={styles.chatGrid}><div className={styles.chatList}>
      {[...conversations.values()].map(booking => <button key={booking.trip_id} aria-pressed={selected === booking.trip_id} onClick={() => setSelected(booking.trip_id)}><strong>{booking.owner || booking.can_drive ? booking.rider_name : booking.driver_name}</strong><span>{formatTime(booking.departure_at)} IST</span></button>)}
    </div>{current ? <RideConversation token={token} tripId={current.trip_id} isDriver={Boolean(current.owner || current.can_drive)} /> : <p className={styles.muted}>Select a conversation to open it.</p>}</div>}
  </section>;
}

export function DashboardAccount({ token, name, email, initials, verified, onNavigate, openRide, signOut }: {
  token: string; name: string; email: string; initials: string; verified: boolean; onNavigate: (view: string) => void; openRide: (section: RideSection) => void; signOut: () => void;
}) {
  return <div className={styles.stack}>
    <section className={styles.profileCard}><span className={styles.avatar}>{initials}</span><div><h2>{name}</h2><p>{email}</p>{verified && <span className={styles.verified}><DashboardIcon name="check" /> Verified PES email</span>}</div></section>
    <section className={styles.panel}><div className={styles.actions}><button className={styles.primary} onClick={() => openRide("find")}>Ride as passenger</button><button className={styles.secondary} onClick={() => openRide("offer")}>Offer as driver</button></div></section>
    <DashboardWallet token={token} />
    <section className={styles.panel}>{[
      ["Profile & settings", () => onNavigate("settings")], ["My vehicle", () => onNavigate("vehicle")],
      ["My rides", () => openRide("bookings")], ["Planned rides", () => onNavigate("plan")], ["Notifications", () => openRide("updates")],
    ].map(([label, action]) => <button className={styles.accountRow} key={label as string} onClick={action as () => void}>{label as string}<DashboardIcon name="arrow" /></button>)}
      <button className={styles.accountRow + " " + styles.danger} onClick={signOut}>Sign out <DashboardIcon name="arrow" /></button>
    </section>
  </div>;
}

type WalletEntry = { id: number; kind: string; amount_minor: number };
type DemoWallet = { available_minor: number; held_minor: number; pending_release_minor: number; entries: WalletEntry[] };
const readWallet = (result: { enabled: boolean; wallet?: DemoWallet }) => result;
const credits = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);

function DashboardWallet({ token }: { token: string }) {
  const { data, error, reload } = useLoad(token, "wallet", readWallet);
  const [updated, setUpdated] = useState<DemoWallet>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const actionKey = useRef<{ operation: string; key: string } | undefined>(undefined);
  const wallet = updated ?? data?.wallet;

  async function mutate(operation: "topup" | "release") {
    if (busy) return;
    if (actionKey.current?.operation !== operation) actionKey.current = { operation, key: crypto.randomUUID() };
    setBusy(true);
    setProblem("");
    try {
      const response = await fetch(`/api/mobility/address-rides/wallet/${operation}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": actionKey.current.key,
        },
        body: JSON.stringify(operation === "topup" ? { amount_minor: 10000 } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) emitUnauthorized(token);
        throw Error(result.error?.code === "DEMO_WALLET_LIMIT" ? "Your demo wallet has reached its balance limit." : "The wallet update failed. Try again.");
      }
      setUpdated(result);
      actionKey.current = undefined;
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "The wallet update failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !wallet) return <section className={styles.panel}><h2>Demo wallet</h2><p role="alert">{error}</p><button className={styles.secondary} onClick={reload}>Retry wallet</button></section>;
  if (!data?.enabled || !wallet) return null;

  return <section className={styles.panel}>
    <h2>Demo wallet</h2>
    <p className={styles.muted}>Simulated ride payments use credits with no cash value.</p>
    <p><strong>{credits(wallet.available_minor)}</strong> available · {credits(wallet.held_minor)} held</p>
    <p className={styles.muted}>{credits(wallet.pending_release_minor)} in pending driver payouts</p>
    {problem && <p role="alert" className={styles.danger}>{problem}</p>}
    <div className={styles.actions}>
      <button className={styles.primary} disabled={busy} onClick={() => void mutate("topup")}>Add ₹100 demo credits</button>
      <button className={styles.secondary} disabled={busy || wallet.pending_release_minor === 0} onClick={() => void mutate("release")}>Release eligible payouts</button>
    </div>
    {wallet.entries.length > 0 && <details><summary>Transaction history</summary>
      {wallet.entries.map(entry => <div key={entry.id} className={styles.activity}>
        <strong>{credits(entry.amount_minor)}</strong><span>{entry.kind.replaceAll("_", " ")}</span>
      </div>)}
    </details>}
  </section>;
}

const readVehicles = (result: { data: Vehicle[]; demo_vehicle_enabled: boolean }) => result;
export function DashboardVehicles({ token, onOffer }: { token: string; onOffer: () => void }) {
  const { data, error, reload } = useLoad(token, "vehicles", readVehicles);
  const [registration, setRegistration] = useState("");
  const [candidate, setCandidate] = useState<Vehicle>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState(false);
  async function lookup(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setProblem(""); setCandidate(undefined); setSaved(false);
    try { setCandidate((await api(token, "vehicles/lookup", { registration })).data); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : "Vehicle lookup failed."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!candidate || busy) return;
    setBusy(true); setProblem("");
    try { await api(token, "vehicles", { registration: candidate.registration }); setSaved(true); setCandidate(undefined); reload(); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : "Vehicle could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className={styles.stack}>
    <section className={styles.panel}>
      {error && <p role="alert">{error} <button className={styles.link} onClick={reload}>Retry</button></p>}
      {!data && !error && <p role="status">Loading your vehicles…</p>}
      {data?.demo_vehicle_enabled && <form className={styles.vehicleForm} onSubmit={lookup}>
        <label htmlFor="vehicle-registration">Vehicle number</label>
        <div className={styles.plate}><span aria-hidden="true">IND</span><input id="vehicle-registration" autoCapitalize="characters" value={registration} onChange={event => { setRegistration(event.target.value.toUpperCase()); setCandidate(undefined); setSaved(false); }} placeholder="KA00DE0007" maxLength={20} required disabled={busy} /></div>
        <p className={styles.muted}>Use a sample number from KA00DE0001 to KA00DE0010.</p>
        <button className={styles.primary} disabled={busy || !registration.trim()}>{busy ? "Please wait…" : "Fetch demo details"}</button>
      </form>}
      {data && !data.demo_vehicle_enabled && <p className={styles.muted}>Demo lookup is unavailable in this environment.</p>}
      {problem && <p role="alert" className={styles.danger}>{problem}</p>}
      {candidate && <article className={styles.activity}><strong>{candidate.name}</strong><span>{candidate.registration} · {candidate.passenger_seats} passenger seats</span><span className={styles.verified}>{candidate.description || "Demo verified — simulated vehicle lookup, not RTO verified."}</span><button className={styles.primary} disabled={busy} onClick={() => void save()}>Save vehicle</button></article>}
      {saved && <p role="status">Vehicle saved.</p>}
    </section>
    {Boolean(data?.data.length) && <section className={styles.panel}><h2>Saved vehicles</h2>{data?.data.map(vehicle => <article className={styles.activity} key={vehicle.id}><strong>{vehicle.name}</strong><span>{vehicle.registration} · {vehicle.passenger_seats} passenger seats</span>{vehicle.demo_verified && <span className={styles.verified}>{vehicle.description || "Demo verified — simulated vehicle lookup, not RTO verified."}</span>}</article>)}<button className={styles.primary} onClick={onOffer}>Offer a ride <DashboardIcon name="arrow" /></button></section>}
  </div>;
}
