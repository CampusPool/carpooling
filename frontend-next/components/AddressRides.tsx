"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import AddressPlacePicker, { type AddressPlace } from "./AddressPlacePicker";
import CanonicalRouteMap from "./CanonicalRouteMap";
import RideConversation from "./RideConversation";
import { loadMapsSdk } from "../lib/maps-loader.mjs";
import { emitUnauthorized } from "../lib/session-events";
import { initialCommuteSchedule, isFutureCommute, istDateTime } from "../lib/commute-time";
import styles from "./AddressRides.module.css";

type Json = Record<string, any>;
type Vehicle = { id: number; name: string; type: "car" | "bike" };
const noPoints: { id: number; name: string; lat: number; lng: number }[] = [];
const rows = (data: any): Json[] => Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
const when = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);

async function api(path: string, token: string, method = "GET", data?: Json, key?: string) {
  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  if (data) headers.set("Content-Type", "application/json");
  if (key) headers.set("Idempotency-Key", key);
  const response = await fetch(`/api/${path}`, { method, headers, body: data ? JSON.stringify(data) : undefined, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized(token);
    const code = body.error?.code;
    const messages: Record<string, string> = {
      MEMBERSHIP_REQUIRED: "Your college membership needs approval before you can use rides.",
      HOST_APPROVAL_REQUIRED: "Complete driver onboarding and vehicle approval before offering a ride.",
      DRIVER_APPROVAL_REQUIRED: "Complete driver onboarding and vehicle approval before offering a ride.",
      VEHICLE_REQUIRED: "Choose an approved vehicle to offer a ride.",
      NO_ROUTE: "These addresses do not have a supported road route. Try a nearby road-accessible address.",
      ROUTE_PROVIDER_UNAVAILABLE: "Road routing is temporarily unavailable. Please try again.",
      COMMUTE_QUOTE_CHANGED: "This ride changed. Search again before requesting a seat.",
      COMMUTE_TRIP_CLOSED: "This ride has already departed or closed.",
      NOT_SEAT_AVAILABLE: "That seat has already been taken. Search for another ride.",
    };
    throw new Error(messages[code] || body.message || body.error?.message || (typeof code === "string" ? code.replaceAll("_", " ") : "This action could not be completed. Please try again."));
  }
  return body;
}

export default function AddressRides({ token, onDriverOnboarding }: { token: string; onDriverOnboarding?: () => void }) {
  const initial = useMemo(() => initialCommuteSchedule("08:30"), []);
  const [mode, setMode] = useState<"find" | "offer" | "bookings" | "updates">("find");
  const [origin, setOrigin] = useState<AddressPlace>();
  const [destination, setDestination] = useState<AddressPlace>();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [mapStatus, setMapStatus] = useState("loading");
  const [mapRetry, setMapRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleLoaded, setVehicleLoaded] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const [rides, setRides] = useState<Json[]>([]);
  const [offers, setOffers] = useState<Json[]>([]);
  const [bookings, setBookings] = useState<Json[]>([]);
  const [notifications, setNotifications] = useState<Json[]>([]);
  const unread = notifications.filter(item => !item.read_at).length;
  const [searched, setSearched] = useState(false);
  const attempts = useRef(new Map<string, string>());
  const edited = useRef(false);
  const pickup = useMemo(() => origin ? { id: 1, name: origin.label, lat: origin.lat, lng: origin.lng } : undefined, [origin]);
  const dropoff = useMemo(() => destination ? { id: 2, name: destination.label, lat: destination.lat, lng: destination.lng } : undefined, [destination]);

  useEffect(() => loadMapsSdk({ fetchImpl: fetch, documentRef: document, google: (window as any).google,
    onReady: () => setMapStatus("ready"), onUnavailable: () => setMapStatus("unavailable"),
  }), [mapRetry]);

  const refresh = useCallback(async () => {
    const [bookingResult, offerResult, notificationResult] = await Promise.allSettled([
      api("mobility/address-rides/bookings", token), api("mobility/address-rides/offers", token), api("mobility/address-rides/notifications", token),
    ]);
    setLoadError(bookingResult.status === "rejected" || offerResult.status === "rejected" || notificationResult.status === "rejected" ? "Ride updates could not load. Refresh to try again." : "");
    if (bookingResult.status === "fulfilled") setBookings(rows(bookingResult.value));
    if (offerResult.status === "fulfilled") setOffers(rows(offerResult.value));
    if (notificationResult.status === "fulfilled") setNotifications(rows(notificationResult.value));
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    let active = true;
    api("mobility/address-rides/me", token).then(identity => {
      const saved = identity.profile;
      if (!active || edited.current || !saved?.onboarding_complete) return;
      const validPlace = (value: any): value is AddressPlace => typeof value?.label === "string" && value.label.trim().length > 0
        && Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= 12.65 && value.lat <= 13.35 && value.lng >= 77.2 && value.lng <= 77.95;
      if (validPlace(saved.home)) setOrigin(saved.home);
      if (validPlace(saved.campus)) setDestination(saved.campus);
      const schedule = initialCommuteSchedule(saved.outbound_time);
      setDate(schedule.date); setTime(schedule.time);
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.all([api("cars", token), api("mobility/membership/me", token), api("mobility/driver-onboarding/me", token)])
      .then(([owned, membership, onboarding]) => {
        if (!active) return;
        const approved = (membership.host_applications || []).filter((item: Json) => item.status === "approved");
        const checks = rows(onboarding);
        const available = rows(owned).flatMap(car => {
          const application = approved.find((item: Json) => Number(item.car_id) === Number(car.id));
          const review = checks.find(item => Number(item.car_id) === Number(car.id) && item.status === "approved" && item.vehicle_type === application?.vehicle_type);
          if (!application || !review || !Number.isSafeInteger(Number(car.id)) || !Number.isInteger(review.legal_passenger_capacity) || review.legal_passenger_capacity < 1
            || (application.vehicle_type === "bike" ? review.legal_passenger_capacity !== 1 : application.vehicle_type !== "car")) return [];
          const name = [car.brand?.name || car.brand, car.model?.name || car.model, car.patent].filter(value => typeof value === "string").join(" · ");
          return [{ id: Number(car.id), name: name || `Vehicle ${car.id}`, type: application.vehicle_type as "car" | "bike" }];
        });
        setVehicles(available);
        setVehicleId(available[0] ? String(available[0].id) : "");
        setVehicleLoaded(true);
      }).catch(() => { if (active) { setVehicleLoaded(true); setVehicleError("Vehicle information could not load. Reopen Campus rides to try again."); } });
    return () => { active = false; };
  }, [token]);

  async function mutate(path: string, body: Json) {
    const signature = path + JSON.stringify(body);
    const key = attempts.current.get(signature) || crypto.randomUUID();
    attempts.current.set(signature, key);
    const result = await api(`mobility/address-rides/${path}`, token, "POST", body, key);
    attempts.current.delete(signature);
    return result;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setSearched(false); setRides([]);
    if (!origin || !destination) { setError("Select your pickup and destination from the address suggestions."); return; }
    if (origin.lat === destination.lat && origin.lng === destination.lng) { setError("Choose different pickup and destination addresses."); return; }
    if (!isFutureCommute(date, time)) { setError("Choose a pickup time at least 15 minutes from now. Times are in IST."); return; }
    const vehicle = vehicles.find(item => String(item.id) === vehicleId);
    if (mode === "offer" && !vehicle) { setError("Choose an approved vehicle to offer a ride."); return; }
    setBusy(true);
    try {
      await api("mobility/address-rides/profile", token, "PUT", {
        role: mode === "offer" ? "driver" : "rider", vehicle_preference: mode === "offer" ? vehicle!.type : "both", schedule_mode: "custom",
        home: origin, campus: destination, outbound_time: time, return_time: time, weekdays: [1, 2, 3, 4, 5, 6, 7], max_walk_meters: 999,
      });
      if (mode === "offer") {
        await mutate("offers", { date, direction: "outbound", vehicle_type: vehicle!.type, car_id: vehicle!.id, total_seats: 1,
          choice: "DIRECT_RIDER_PICKUP", max_detour_meters: 3000, max_detour_seconds: 600 });
        setNotice("Your ride is published. Riders can now request your available seat.");
        await refresh();
      } else {
        const result = await api(`mobility/address-rides/rides?direction=outbound&date=${encodeURIComponent(date)}&vehicle_type=both&pickup_choice=both`, token);
        setRides(rows(result)); setSearched(true);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Your ride could not be updated."); }
    finally { setBusy(false); }
  }

  async function action(path: string, body: Json, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await mutate(path, body); setNotice(message); await refresh(); return true; }
    catch (error) { setError(error instanceof Error ? error.message : "Your ride could not be updated."); return false; }
    finally { setBusy(false); }
  }

  function changePlace(kind: "origin" | "destination", place?: AddressPlace) {
    edited.current = true;
    if (kind === "origin") setOrigin(place); else setDestination(place);
    setRides([]); setSearched(false); setNotice("");
  }

  function changeMode(next: typeof mode) { setMode(next); setError(""); setNotice(""); setRides([]); setSearched(false); }

  return <div className={styles.panel}>
    <div className={styles.tabs} role="tablist" aria-label="Ride options">
      <button type="button" role="tab" aria-selected={mode === "find"} onClick={() => changeMode("find")}>Find a ride</button>
      <button type="button" role="tab" aria-selected={mode === "offer"} onClick={() => changeMode("offer")}>Offer a ride</button>
      <button type="button" role="tab" aria-selected={mode === "bookings"} onClick={() => changeMode("bookings")}>Bookings</button>
      <button type="button" role="tab" aria-selected={mode === "updates"} onClick={() => changeMode("updates")}>Updates{unread ? ` (${unread})` : ""}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.message} role="status">{notice}</p>}
    {["find", "offer"].includes(mode) && <>
      <form className={styles.form} onSubmit={submit}>
        <AddressPlacePicker label="Pickup" value={origin} ready={mapStatus === "ready"} disabled={busy} onChange={place => changePlace("origin", place)} />
        <AddressPlacePicker label="Destination" value={destination} ready={mapStatus === "ready"} disabled={busy} onChange={place => changePlace("destination", place)} />
        <label>Travel date<input type="date" min={istDateTime(new Date()).date} value={date} onChange={event => { edited.current = true; setDate(event.target.value); setSearched(false); setRides([]); }} required /></label>
        <label>Pickup time · IST<input type="time" value={time} onChange={event => { edited.current = true; setTime(event.target.value); setSearched(false); setRides([]); }} required /></label>
        {mode === "offer" && <>
          {!!vehicles.length && <label className={styles.wide}>Vehicle<select value={vehicleId} onChange={event => setVehicleId(event.target.value)} required disabled={busy || !vehicles.length}>
            <option value="">Choose your vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
          </select></label>}
          {!vehicleLoaded && <p className={styles.wide} role="status">Loading your vehicles…</p>}
          {vehicleError && <p className={`${styles.error} ${styles.wide}`} role="alert">{vehicleError}</p>}
          {vehicleLoaded && !vehicles.length && !vehicleError && <div className={styles.wide}><p>Complete driver onboarding and vehicle approval to offer a ride.</p>{onDriverOnboarding && <button type="button" className="secondary" onClick={onDriverOnboarding}>Set up a vehicle</button>}</div>}
          {!!vehicles.length && <p className={`${styles.meta} ${styles.wide}`}>Offer one seat with pickup detours up to 3 km and 10 minutes.</p>}
        </>}
        {(mode !== "offer" || !!vehicles.length) && <button type="submit" className={`${styles.primary} ${styles.wide}`} disabled={busy || !origin || !destination || (mode === "offer" && !vehicles.length)}>
          {busy ? "Please wait…" : mode === "offer" ? "Offer this ride" : "Find rides"}
        </button>}
      </form>
      {mapStatus === "unavailable" && <p className={styles.message}>Address search is temporarily unavailable. <button type="button" onClick={() => { setMapStatus("loading"); setMapRetry(value => value + 1); }}>Retry Maps</button></p>}
      {mapStatus === "ready" && <div className={styles.map}><CanonicalRouteMap points={noPoints} pickup={pickup} dropoff={dropoff} /></div>}
      {mode === "find" && searched && !rides.length && <p className={styles.message}>No matching rides yet. Try another pickup time or a nearby address.</p>}
      <div className={styles.results}>{(mode === "find" ? rides : offers).map(ride => {
        const requested = bookings.some(booking => booking.trip_id === ride.trip_id && [0, 1].includes(Number(booking.request_state)));
        return <article className={styles.card} key={`${ride.trip_id}-${ride.quote_token || "offer"}`}>
        <h3>{mode === "find" ? ride.driver_name : "Your published ride"}</h3>
        <p>{ride.pickup_label} → {ride.dropoff_label}</p>
        <p className={styles.meta}>{when(ride.departure_at)} · {ride.vehicle_label || (ride.vehicle_type === "bike" ? "Motorbike" : "Car")} · {ride.seats_available} seat{Number(ride.seats_available) === 1 ? "" : "s"} available</p>
        {typeof ride.total_fare_minor === "number" && <p>Estimated contribution {money(ride.total_fare_minor)}</p>}
        {mode === "offer" && <button type="button" className="secondary" disabled={busy} onClick={() => { if (window.confirm("Cancel this ride? Pending and accepted bookings will be cancelled.")) void action(`trips/${ride.trip_id}/transition`, { action: "cancel" }, "Your ride and its bookings were cancelled."); }}>Cancel ride</button>}
        {mode === "find" && <button type="button" className={styles.primary} disabled={busy || Number(ride.seats_available) < 1 || requested} onClick={() => void action(`rides/${ride.trip_id}/request`, { quote_token: ride.quote_token }, "Seat requested. Your driver will respond in Bookings.").then(saved => { if (saved) setMode("bookings"); })}>{requested ? "Requested" : "Request a seat"}</button>}
      </article>; })}</div>
    </>}
    {mode === "updates" && <section aria-label="Ride updates">
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh updates</button></div>
      {loadError && <p className={styles.error} role="alert">{loadError}</p>}
      {!notifications.length && !loadError && <p className={styles.message}>Booking requests and driver responses will appear here.</p>}
      <div className={styles.results}>{notifications.map(item => <article className={styles.card} key={item.id}>
        <h3>{item.title}{!item.read_at ? " · New" : ""}</h3><p>{item.body}</p>
        <div className={styles.actions}><button type="button" onClick={() => changeMode("bookings")}>View bookings</button>
          {!item.read_at && <button type="button" disabled={busy} onClick={() => void action(`notifications/${item.id}/read`, {}, "Update marked as read.")}>Mark read</button>}
        </div>
      </article>)}</div>
    </section>}
    {mode === "bookings" && <>
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh bookings</button></div>
      {loadError && <p className={styles.error} role="alert">{loadError}</p>}
      {!bookings.length && !loadError && <p className={styles.message}>Your ride requests and driver responses will appear here.</p>}
      <div className={styles.results}>{bookings.map(booking => {
        const owner = booking.owner === true || booking.can_drive === true;
        const accepted = Number(booking.request_state) === 1;
        const planned = !booking.state || booking.state === "planned";
        const active = !["completed", "cancelled"].includes(booking.state);
        const status = booking.state === "completed" ? "Completed" : booking.state === "cancelled" ? "Cancelled" : accepted ? (booking.state === "in_progress" ? "In progress" : "Accepted") : ["Awaiting driver", "Accepted", "Declined", "Cancelled"][Number(booking.request_state)] || "Updated";
        return <article className={styles.card} key={booking.booking_id}>
          <h3>{owner ? booking.rider_name : booking.driver_name}</h3>
          <p>{booking.pickup_label} → {booking.dropoff_label}</p>
          <p className={styles.meta}>{when(booking.departure_at)} · {status}</p>
          <div className={styles.actions}>
            {owner && Number(booking.request_state) === 0 && planned && <>
              <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/accept`, {}, "Rider accepted.")}>Accept rider</button>
              <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/reject`, {}, "Request declined.")}>Decline</button>
            </>}
            {active && planned && [0, 1].includes(Number(booking.request_state)) && <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/cancel`, {}, "Booking cancelled.")}>Cancel booking</button>}
            {owner && accepted && active && <button type="button" disabled={busy} onClick={() => {
              const next = planned ? "start" : booking.participant_state === "alighted" ? "complete" : booking.participant_state === "boarded" ? "alight" : "board";
              void action(`trips/${booking.trip_id}/transition`, { action: next, ...(["board", "alight"].includes(next) ? { passenger_id: Number(booking.rider_id) } : {}) }, "Ride updated.");
            }}>{planned ? "Start ride" : booking.participant_state === "alighted" ? "Complete ride" : booking.participant_state === "boarded" ? "Mark dropped off" : "Mark picked up"}</button>}
          </div>
          {accepted && active && <RideConversation token={token} tripId={Number(booking.trip_id)} isDriver={owner} />}
        </article>;
      })}</div>
    </>}
  </div>;
}
