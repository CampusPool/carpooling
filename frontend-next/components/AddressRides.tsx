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
type Vehicle = { id: number; name: string; registration: string; vehicle_type: "car" | "bike"; passenger_seats: number; demo_verified: boolean };
export type RideMode = "find" | "offer" | "bookings" | "updates";
export type RideDefaults = { origin?: AddressPlace; destination?: AddressPlace; date?: string; time?: string };
const vehicleLabel = (ride: Json) => ride.vehicle_label || (ride.vehicle_type === "bike" ? "Two-wheeler" : "Car");
const distance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
const isDistance = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function RideMetrics({ ride }: { ride: Json }) {
  const metrics = [["Walk to pickup", ride.access_meters], ["Ride distance", ride.ride_meters ?? ride.distance_meters], ["Walk after drop-off", ride.egress_meters]] as const;
  return <dl className={styles.metrics}>{metrics.filter(([, value]) => isDistance(value)).map(([label, value]) => <div key={label}>
    <dt>{label}</dt><dd>{distance(value)}</dd>
  </div>)}</dl>;
}

function mapPoint(value: unknown, id: number, name: string) {
  if (!value || typeof value !== "object" || !("lat" in value) || !("lng" in value)) return undefined;
  const { lat, lng } = value;
  if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) return undefined;
  return { id, name, lat, lng };
}
const noPoints: { id: number; name: string; lat: number; lng: number }[] = [];
const rows = (data: any): Json[] => Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
const when = (value: string) => !Number.isFinite(Date.parse(value)) ? "Time unavailable" : new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
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
      SHARED_RIDE_FIXED_STOPS_REQUIRED: "Search again for meeting points along the driver’s route.",
      VEHICLE_SEAT_LIMIT: "Choose a passenger count within your vehicle’s approved capacity.",
      INSUFFICIENT_DEMO_CREDITS: "Add demo credits under Account, then return to Bookings to pay.",
      STUDENT_DEMO_WALLET_DISABLED: "Demo payments are unavailable in this environment.",
      NOT_SEAT_AVAILABLE: "That seat has already been taken. Search for another ride.",
    };
    throw new Error(messages[code] || body.message || body.error?.message || (typeof code === "string" ? code.replaceAll("_", " ") : "This action could not be completed. Please try again."));
  }
  return body;
}

export default function AddressRides({ token, onDriverOnboarding, initialMode = "find", rideDefaults }: {
  token: string;
  onDriverOnboarding?: () => void;
  initialMode?: RideMode;
  rideDefaults?: RideDefaults;
}) {
  const initial = useMemo(() => initialCommuteSchedule("08:30"), []);
  const [mode, setMode] = useState<RideMode>(initialMode);
  const [origin, setOrigin] = useState(rideDefaults?.origin);
  const [destination, setDestination] = useState(rideDefaults?.destination);
  const [date, setDate] = useState(rideDefaults?.date ?? initial.date);
  const [time, setTime] = useState(rideDefaults?.time ?? initial.time);
  const [mapStatus, setMapStatus] = useState("loading");
  const [mapRetry, setMapRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [seats, setSeats] = useState(1);
  const [vehicleRetry, retryVehicles] = useState(0);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [vehicleLoaded, setVehicleLoaded] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const [rides, setRides] = useState<Json[]>([]);
  const [offers, setOffers] = useState<Json[]>([]);
  const [bookings, setBookings] = useState<Json[]>([]);
  const [notifications, setNotifications] = useState<Json[]>([]);
  const unread = notifications.filter(item => !item.read_at).length;
  const [selectedDetails, setDetails] = useState<{ ride: Json; kind: "match" | "booking" | "offer" }>();
  const detailsRide = selectedDetails?.kind === "booking"
    ? bookings.find(booking => booking.booking_id === selectedDetails.ride.booking_id)
    : selectedDetails?.kind === "offer"
      ? offers.find(offer => offer.trip_id === selectedDetails.ride.trip_id)
      : selectedDetails?.ride;
  const details = selectedDetails && detailsRide ? { kind: selectedDetails.kind, ride: detailsRide } : undefined;
  const [searchSummary, setSearchSummary] = useState<{ distance_meters: number; duration_seconds: number }>();
  const [searched, setSearched] = useState(false);
  const [searchReasons, setSearchReasons] = useState<string[]>([]);
  const [detourKm, setDetourKm] = useState("3");
  const [detourMinutes, setDetourMinutes] = useState("10");
  const attempts = useRef(new Map<string, string>());
  const edited = useRef(Boolean(rideDefaults));
  const latestRefresh = useRef(0);
  const actionPending = useRef(false);
  const selectedVehicle = vehicles.find(item => String(item.id) === vehicleId);
  const pickup = useMemo(() => origin ? { id: 1, name: origin.label, lat: origin.lat, lng: origin.lng } : undefined, [origin]);
  const dropoff = useMemo(() => destination ? { id: 2, name: destination.label, lat: destination.lat, lng: destination.lng } : undefined, [destination]);

  useEffect(() => loadMapsSdk({ fetchImpl: fetch, documentRef: document, google: (window as any).google,
    onReady: () => setMapStatus("ready"), onUnavailable: () => setMapStatus("unavailable"),
  }), [mapRetry]);

  const refresh = useCallback(async () => {
    const generation = ++latestRefresh.current;
    const [bookingResult, offerResult, notificationResult] = await Promise.allSettled([
      api("mobility/address-rides/bookings", token), api("mobility/address-rides/offers", token), api("mobility/address-rides/notifications", token),
    ]);
    if (generation !== latestRefresh.current) return;
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
    setVehicleLoaded(false);
    setVehicleError("");
    api("mobility/address-rides/vehicles", token)
      .then(result => {
        if (!active) return;
        const available = rows(result).filter(car => Number.isInteger(car.id) && Number.isInteger(car.passenger_seats) && car.passenger_seats >= 1
          && ["car", "bike"].includes(car.vehicle_type)) as Vehicle[];
        setVehicles(available);
        setDemoEnabled(result.demo_vehicle_enabled === true);
        const nextVehicle = available[0];
        setVehicleId(String(nextVehicle?.id ?? ""));
        setSeats(previous => Math.min(previous, nextVehicle?.passenger_seats ?? 1));
      })
      .catch(() => { if (active) setVehicleError("Vehicle information could not load."); })
      .finally(() => { if (active) setVehicleLoaded(true); });
    return () => { active = false; };
  }, [token, vehicleRetry]);

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
    if (actionPending.current) return;
    setError(""); setNotice(""); setSearched(false); setRides([]); setDetails(undefined); setSearchSummary(undefined);
    if (!origin || !destination) { setError("Select your pickup and destination from the address suggestions."); return; }
    if (origin.lat === destination.lat && origin.lng === destination.lng) { setError("Choose different pickup and destination addresses."); return; }
    if (!isFutureCommute(date, time)) { setError("Choose a pickup time at least 15 minutes from now. Times are in IST."); return; }
    const vehicle = selectedVehicle;
    if (mode === "offer" && (!vehicleLoaded || vehicleError || !vehicle || seats > vehicle.passenger_seats)) { setError("Choose an approved vehicle to offer a ride."); return; }
    const meters = Math.round(Number(detourKm) * 1000);
    const seconds = Number(detourMinutes) * 60;
    if (mode === "offer" && (!detourKm || !detourMinutes || !Number.isInteger(meters) || meters < 0 || meters > 10000 || !Number.isInteger(seconds) || seconds < 0 || seconds > 1800)) {
      setError("Choose detour limits between 0 and 10 km and between 0 and 30 minutes."); return;
    }
    actionPending.current = true;
    setBusy(true);
    try {
      await api("mobility/address-rides/profile", token, "PUT", {
        role: mode === "offer" ? "driver" : "rider", vehicle_preference: mode === "offer" ? vehicle!.vehicle_type : "both", schedule_mode: "custom",
        home: origin, campus: destination, outbound_time: time, return_time: time, weekdays: [1, 2, 3, 4, 5, 6, 7], max_walk_meters: 999,
      });
      if (mode === "offer") {
        await mutate("offers", { date, direction: "outbound", vehicle_type: vehicle!.vehicle_type, car_id: vehicle!.id, total_seats: seats,
          choice: "DIRECT_RIDER_PICKUP", max_detour_meters: meters, max_detour_seconds: seconds });
        setNotice("Your ride is published. Riders can now request a seat.");
        await refresh();
      } else {
        const result = await api(`mobility/address-rides/rides?direction=outbound&date=${encodeURIComponent(date)}&vehicle_type=both&pickup_choice=both`, token);
        setRides(rows(result)); setSearchSummary(result.route_summary);
        setSearchReasons(Array.isArray(result.excluded) ? result.excluded.map((item: Json) => item.reason) : []);
        setSearched(true);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Your ride could not be updated."); }
    finally { actionPending.current = false; setBusy(false); }
  }

  async function action(path: string, body: Json, message: string) {
    if (actionPending.current) return false;
    actionPending.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await mutate(path, body); setNotice(message); await refresh(); return true; }
    catch (error) { setError(error instanceof Error ? error.message : "Your ride could not be updated."); return false; }
    finally { actionPending.current = false; setBusy(false); }
  }

  function changePlace(kind: "origin" | "destination", place?: AddressPlace) {
    edited.current = true;
    if (kind === "origin") setOrigin(place); else setDestination(place);
    setRides([]); setSearched(false); setNotice(""); setDetails(undefined);
  }

  function changeMode(next: typeof mode) { setMode(next); setError(""); setNotice(""); setDetails(undefined); }

  function hasBooking(ride: Json) {
    return bookings.some(booking => booking.trip_id === ride.trip_id && [0, 1].includes(Number(booking.request_state)));
  }

  async function requestRide(ride: Json) {
    const saved = await action(`rides/${ride.trip_id}/request`, { quote_token: ride.quote_token }, "Seat requested. Your driver will respond in Bookings.");
    if (saved) { setDetails(undefined); setMode("bookings"); }
  }

  return <div className={styles.panel}>
    <div className={styles.tabs} role="tablist" aria-label="Ride options">
      <button type="button" role="tab" aria-selected={mode === "find"} disabled={busy} onClick={() => changeMode("find")}>Find a ride</button>
      <button type="button" role="tab" aria-selected={mode === "offer"} disabled={busy} onClick={() => changeMode("offer")}>Offer a ride</button>
      <button type="button" role="tab" aria-selected={mode === "bookings"} disabled={busy} onClick={() => changeMode("bookings")}>Bookings</button>
      <button type="button" role="tab" aria-selected={mode === "updates"} disabled={busy} onClick={() => changeMode("updates")}>Updates{unread ? ` (${unread})` : ""}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.message} role="status">{notice}</p>}
    {details && <section className={styles.detail} aria-label="Ride details">
      <button className={styles.secondary} type="button" onClick={() => setDetails(undefined)}>← Back to {details.kind === "booking" ? "bookings" : "rides"}</button>
      <h2>{details.kind === "offer" ? "Your published ride" : details.ride.driver_name || "Ride details"}</h2>
      <p className={styles.meta}>{when(details.ride.departure_at)} · {vehicleLabel(details.ride)}</p>
      {details.kind === "offer" && isDistance(details.ride.max_detour_meters) && Number.isInteger(details.ride.max_detour_seconds) &&
        <p className={styles.meta}>Detour limit: {distance(details.ride.max_detour_meters)} · {details.ride.max_detour_seconds / 60} min</p>}
      {details.ride.driver_verified_pes === true && <p className={styles.verified}>✓ Verified PES email</p>}
      <RouteLabels ride={details.ride} />
      <RideMetrics ride={details.ride} />
      {mapStatus === "ready" && (details.ride.route_map?.points || (details.kind === "match" && pickup && dropoff)) && <CanonicalRouteMap points={noPoints}
        pickup={details.ride.route_map?.points ? mapPoint(details.ride.route_map.points.pickup || details.ride.route_map.points.driver_start, 1, "Pickup") : pickup}
        dropoff={details.ride.route_map?.points ? mapPoint(details.ride.route_map.points.dropoff || details.ride.route_map.points.driver_end, 2, "Drop-off") : dropoff}
        geometry={details.ride.route_map?.driver_geometry} previewLabel={details.kind === "match" ? "Your pickup-to-destination preview" : undefined} />}
      {details.kind === "match" && <div className={styles.cardFooter}>
        <RideFare ride={details.ride} />
        <button type="button" className={styles.primary} disabled={busy || Number(details.ride.seats_available) < 1 || hasBooking(details.ride)} onClick={() => void requestRide(details.ride)}>Request ride</button>
      </div>}
    </section>}
    {!details && ["find", "offer"].includes(mode) && <>
      <form className={styles.form} onSubmit={submit}>
        <header className={styles.wide}><h2>{mode === "offer" ? "Create a ride" : "Find a ride"}</h2>
          <p>{mode === "offer" ? "Choose where you’ll drive and when you’ll leave." : "Choose your pickup, destination and departure time."}</p></header>
        <AddressPlacePicker label="Pickup" value={origin} ready={mapStatus === "ready"} disabled={busy} onChange={place => changePlace("origin", place)} />
        <AddressPlacePicker label="Destination" value={destination} ready={mapStatus === "ready"} disabled={busy} onChange={place => changePlace("destination", place)} />
        <div className={styles.wide}><button type="button" className={styles.secondary} disabled={busy || !origin || !destination} onClick={() => {
          const from = origin; changePlace("origin", destination); changePlace("destination", from);
        }}>⇄ Swap locations</button></div>
        <label>Travel date<input type="date" disabled={busy} min={istDateTime(new Date()).date} value={date} onChange={event => { edited.current = true; setDate(event.target.value); setSearched(false); setRides([]); }} required /></label>
        <label>Pickup time · IST<input type="time" disabled={busy} value={time} onChange={event => { edited.current = true; setTime(event.target.value); setSearched(false); setRides([]); }} required /></label>
        {mode === "offer" && <>
          {!!vehicles.length && <label className={styles.wide}>Vehicle<select value={vehicleId} onChange={event => { setVehicleId(event.target.value); setSeats(1); }} required disabled={busy || !vehicles.length}>
            <option value="">Choose your vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.registration}</option>)}
          </select></label>}
          {!vehicleLoaded && <p className={styles.wide} role="status">Loading your vehicles…</p>}
          {vehicleError && <div className={styles.wide}><p className={styles.error} role="alert">{vehicleError}</p><button type="button" className={styles.secondary} onClick={() => retryVehicles(attempt => attempt + 1)}>Retry vehicles</button></div>}
          {vehicleLoaded && !vehicles.length && !vehicleError && <div className={styles.wide}><p>{demoEnabled ? "Add a demo vehicle to publish your ride." : "Complete driver onboarding and vehicle approval to offer a ride."}</p>{onDriverOnboarding && <button type="button" className="secondary" onClick={onDriverOnboarding}>Set up a vehicle</button>}</div>}
          {selectedVehicle && <label className={styles.wide}>Passenger seats
            <select value={seats} onChange={event => setSeats(Number(event.target.value))} disabled={busy}>
              {Array.from({ length: selectedVehicle.passenger_seats }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}
            </select>
          </label>}
          {selectedVehicle && <>
            <label>Maximum detour (km)<input type="number" min="0" max="10" step="0.1" value={detourKm} onChange={event => setDetourKm(event.target.value)} disabled={busy} required /></label>
            <label>Maximum extra drive (minutes)<input type="number" min="0" max="30" step="1" value={detourMinutes} onChange={event => setDetourMinutes(event.target.value)} disabled={busy} required /></label>
            <p className={`${styles.meta} ${styles.wide}`}>Both limits apply to this offer. Enter zero to keep the published route.</p>
          </>}
          {selectedVehicle?.demo_verified && <p className={`${styles.meta} ${styles.wide}`}>Demo verified — simulated vehicle lookup, not RTO verified.</p>}
          {seats > 1 && <p className={`${styles.meta} ${styles.wide}`}>Shared rides use meeting points along the agreed route.</p>}
        </>}
        {(mode !== "offer" || !!vehicles.length) && <button type="submit" className={`${styles.primary} ${styles.wide}`} disabled={busy || !origin || !destination || (mode === "offer" && (!vehicleLoaded || Boolean(vehicleError) || !selectedVehicle))}>
          {busy ? "Please wait…" : mode === "offer" ? "Publish ride" : "Find rides"}
        </button>}
      </form>
      {mapStatus === "unavailable" && <p className={styles.message}>Address search is temporarily unavailable. <button type="button" onClick={() => { setMapStatus("loading"); setMapRetry(value => value + 1); }}>Retry Maps</button></p>}
      {mapStatus === "ready" && pickup && dropoff && !searched && <div className={styles.map}><CanonicalRouteMap points={noPoints} pickup={pickup} dropoff={dropoff} /></div>}
      {mode === "find" && searched && !rides.length && <div className={styles.message} role="status">
        <strong>No matching rides for {when(`${date}T${time}:00+05:30`)} IST.</strong>
        {searchReasons.includes("PICKUP_TIME_MISMATCH") && <p>An offer’s pickup would be outside the 15-minute window around your requested time.</p>}
        {searchReasons.includes("DETOUR_LIMIT_EXCEEDED") && <p>A pickup needed a longer detour than the driver allowed.</p>}
        {searchReasons.some(reason => !["PICKUP_TIME_MISMATCH", "DETOUR_LIMIT_EXCEEDED"].includes(reason)) && <p>Other offers could not reach your stops within their route or walking limits.</p>}
        {!searchReasons.length && <p>No eligible offer was found near that time for this trip.</p>}
        <p>Adjust the pickup time above or try a nearby meeting point.</p>
      </div>}
      {mode === "find" && searched && !!rides.length && <div className={styles.resultHeading}>
        <h2>{rides.length} matching {rides.length === 1 ? "ride" : "rides"}</h2>
        {searchSummary && isDistance(searchSummary.distance_meters) && <span>{distance(searchSummary.distance_meters)} between your locations</span>}
      </div>}
      {mode === "offer" && !!offers.length && <h2>Your published rides</h2>}
      <div className={styles.results}>{(mode === "find" ? rides : offers).map(ride => <article className={styles.card} key={`${ride.trip_id}-${ride.quote_token || "offer"}`}>
        <header className={styles.cardHeading}>
          <div className={styles.avatar} aria-hidden="true">{(ride.driver_name || "You").trim().charAt(0).toUpperCase()}</div>
          <div><h3>{mode === "find" ? ride.driver_name : "Your published ride"}</h3><p className={styles.meta}>Pickup · {when(ride.departure_at)}</p>{ride.driver_verified_pes === true && <p className={styles.verified}>✓ Verified PES email</p>}</div>
          <span className={styles.vehicleTag}>{vehicleLabel(ride)}</span>
        </header>
        <RouteLabels ride={ride} />
        <RideMetrics ride={ride} />
        <div className={styles.cardFooter}>
          <RideFare ride={ride} />
          <div className={styles.actions}>
            <button className={styles.secondary} type="button" onClick={() => setDetails({ ride, kind: mode === "find" ? "match" : "offer" })}>Ride details</button>
            {mode === "offer" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => { if (window.confirm("Cancel this ride? Pending and accepted bookings will be cancelled.")) void action(`trips/${ride.trip_id}/transition`, { action: "cancel" }, "Your ride and its bookings were cancelled."); }}>Cancel ride</button>}
            {mode === "find" && <button type="button" className={styles.primary} disabled={busy || Number(ride.seats_available) < 1 || hasBooking(ride)} onClick={() => void requestRide(ride)}>{hasBooking(ride) ? "Requested" : "Request ride"}</button>}
          </div>
        </div>
      </article>)}</div>
    </>}
    {mode === "updates" && <section aria-label="Ride updates">
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh updates</button></div>
      {loadError && <p className={styles.error} role="alert">{loadError}</p>}
      {!notifications.length && !loadError && <p className={styles.message}>Booking requests and driver responses will appear here.</p>}
      <div className={styles.results}>{notifications.map(item => <article className={styles.card} key={item.id}>
        <h3>{item.title}{!item.read_at ? " · New" : ""}</h3><p>{item.body}</p>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => changeMode("bookings")}>View bookings</button>
          {!item.read_at && <button type="button" disabled={busy} onClick={() => void action(`notifications/${item.id}/read`, {}, "Update marked as read.")}>Mark read</button>}
        </div>
      </article>)}</div>
    </section>}
    {!details && mode === "bookings" && <>
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
          {booking.wallet_state && accepted && <p className={styles.meta}>Demo fare {money(booking.fare_minor)} · {booking.wallet_state === "unpaid" ? "Unpaid" : booking.wallet_state === "held" ? "Credits held" : booking.wallet_state === "released" ? "Credits released" : "Credits refunded"}</p>}
          {booking.wallet_state === "refunded" && !accepted && <p className={styles.meta}>Demo credits refunded</p>}
          {booking.release_at && booking.wallet_state === "held" && <p className={styles.meta}>Driver payout eligible after {when(booking.release_at)}</p>}
          {booking.receipt?.receipt_number && <p className={styles.meta}>Demo receipt {booking.receipt.receipt_number}</p>}
          <div className={styles.actions}>
            {!owner && accepted && active && planned && booking.wallet_state === "unpaid" && <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/payment/pay`, {}, "Demo credits held for this ride.")}>Pay with demo credits</button>}
            {!owner && accepted && booking.state === "completed" && booking.wallet_state === "held" && !booking.rider_arrived_at && <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/payment/arrive`, {}, "Arrival confirmed. Demo credits can be released after three hours.")}>Confirm arrival</button>}
            {owner && booking.wallet_state === "released" && !booking.receipt && <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/payment/confirm-payment-received`, {}, "Demo receipt issued.")}>Issue demo receipt</button>}
            {owner && Number(booking.request_state) === 0 && planned && <>
              <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/accept`, {}, "Rider accepted.")}>Accept rider</button>
              <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/reject`, {}, "Request declined.")}>Decline</button>
            </>}
            {active && planned && [0, 1].includes(Number(booking.request_state)) && <button type="button" disabled={busy} onClick={() => void action(`bookings/${booking.booking_id}/cancel`, {}, "Booking cancelled.")}>Cancel booking</button>}
            {accepted && <button type="button" onClick={() => setDetails({ ride: booking, kind: "booking" })}>Ride details</button>}
            {owner && accepted && active && (booking.participant_state !== "alighted" || bookings.filter(item => item.trip_id === booking.trip_id && Number(item.request_state) === 1).every(item => item.participant_state === "alighted")) && <button type="button" disabled={busy} onClick={() => {
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

function RouteLabels({ ride }: { ride: Json }) {
  return <ol className={styles.routeLabels}>
    <li>{ride.pickup_label}</li>
    <li>{ride.dropoff_label}</li>
  </ol>;
}

function RideFare({ ride }: { ride: Json }) {
  return <div className={styles.fare}>
    {typeof ride.total_fare_minor === "number" && <><strong>{money(ride.total_fare_minor)}</strong><span>Estimated contribution</span></>}
    {Number.isInteger(ride.seats_available) && <span>{ride.seats_available} {ride.seats_available === 1 ? "seat" : "seats"} available</span>}
  </div>;
}
