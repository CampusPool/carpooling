"use client";

import { emitUnauthorized } from "../lib/session-events";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import CanonicalPlacePicker from "./CanonicalPlacePicker";
import CanonicalRouteMap from "./CanonicalRouteMap";
import { loadMapsSdk } from "../lib/maps-loader.mjs";

const studentPreview = process.env.NEXT_PUBLIC_STUDENT_ONLY === "1";

type Json = Record<string, any>;
type Point = { id: number; name: string; lat?: number; lng?: number };
type HostApplication = { car_id: number; vehicle_type: "car" | "bike"; status: string };
type ApprovedVehicle = HostApplication & { legal_passenger_capacity: number };

function rows(value: any): any[] {
  return Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
}

function indiaDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}
function todayIndia(): string { return indiaDateTime(new Date()).slice(0, 10); }
function earliestDepartureIndia(): string { return indiaDateTime(new Date(Date.now() + 17 * 60_000)); }

function errorText(body: any, status: number): string {
  const code = body?.error?.code;
  const messages: Record<string, string> = {
    COHORT_NOT_CONFIGURED: "College access is not configured on this server.",
    MEMBERSHIP_REQUIRED: "Operator approved college membership is required for ride discovery and requests.",
    HOST_APPROVAL_REQUIRED: "An operator must approve your vehicle before you can publish.",
    ROUTING_MISCONFIGURED: "Route quotes are unavailable until the routing provider is configured.",
    CATALOG_CHANGED: "The pickup catalog changed. Reload the points and request a fresh quote.",
    NO_ROUTE: "No route is available between those catalog points.",
    ROUTE_PROVIDER_UNAVAILABLE: "The route provider is temporarily unavailable. Try again later.",
    QUOTE_EXPIRED: "The quote expired. Request a fresh quote before publishing.",
  };
  return (code && messages[code]) || body?.message || body?.error?.message || `Request failed (${status}).`;
}

async function api(path: string, token: string, method = "GET", data?: Json, key?: string): Promise<any> {
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (data) {
    headers.set("Content-Type", "application/json");
    if (key) headers.set("Idempotency-Key", key);
  }
  const response = await fetch(`/api/${path}`, {
    method, headers, body: data ? JSON.stringify(data) : undefined, cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") emitUnauthorized(token);
    throw new Error(errorText(body, response.status));
  }
  return body;
}

export default function CanonicalPool({ token, initialMode = "find", accountRole }: { token: string; initialMode?: "find" | "publish"; accountRole?: "rider" | "driver" }) {
  const [mode, setMode] = useState<"find" | "publish" | "bookings">(initialMode);
  const [membership, setMembership] = useState<Json>();
  const [points, setPoints] = useState<Point[]>([]);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [mapRetry, setMapRetry] = useState(0);
  const [pickup, setPickup] = useState<Point>();
  const [dropoff, setDropoff] = useState<Point>();
  const [cars, setCars] = useState<Json[]>([]);
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [onboardings, setOnboardings] = useState<Json[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quote, setQuote] = useState<Json>();
  const [matches, setMatches] = useState<Json[]>([]);
  const [hostRequests, setHostRequests] = useState<Json[]>([]);
  const [myBookings, setMyBookings] = useState<Json[]>([]);
  const [bookingLoadError, setBookingLoadError] = useState("");
  const [searched, setSearched] = useState(false);
  const publishAttempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const requestKeys = useRef(new Map<string, string>());

  const refreshBookings = useCallback(async () => {
    setBookingLoadError("");
    const errors: string[] = [];
    const [hostRequestsResult, riderBookingsResult, identityResult] = await Promise.allSettled([
      accountRole === "rider" ? Promise.resolve({ data: [] }) : api("users/requests", token),
      accountRole === "driver" ? Promise.resolve({ data: [] }) : api("users/seat-requests", token), api("users/me", token),
    ]);
    const requestedHostRows = hostRequestsResult.status === "fulfilled" ? rows(hostRequestsResult.value) : [];
    const riderBookings = riderBookingsResult.status === "fulfilled" ? rows(riderBookingsResult.value) : [];
    if (hostRequestsResult.status === "rejected") errors.push(`Your hosted ride requests could not be loaded: ${hostRequestsResult.reason?.message || "request failed"}`);
    if (riderBookingsResult.status === "rejected") errors.push(`Your seat requests could not be loaded: ${riderBookingsResult.reason?.message || "request failed"}`);
    const identity = identityResult.status === "fulfilled" ? (identityResult.value?.data ?? identityResult.value) : undefined;
    const userId = Number(identity?.id);
    const validUserId = Number.isSafeInteger(userId) && userId > 0;
    if (identityResult.status === "rejected") errors.push(`Your account identity could not be verified: ${identityResult.reason?.message || "request failed"}`);
    else if (!validUserId) errors.push("Your account identity response is invalid; cancellation actions are unavailable.");

    const pending = requestedHostRows.filter((request) => Number.isSafeInteger(Number(request.trip_id)) && Number(request.trip_id) > 0);
    if (pending.length !== requestedHostRows.length) errors.push("Some hosted requests had invalid ride IDs and were omitted.");
    const validBookings = riderBookings.filter((booking) => Number.isSafeInteger(Number(booking.trip_id)) && Number(booking.trip_id) > 0 && [0, 1].includes(Number(booking.request_state)));
    if (validBookings.length !== riderBookings.filter((booking) => [0, 1].includes(Number(booking.request_state))).length) errors.push("Some seat requests had invalid ride IDs and were omitted.");
    setHostRequests(pending);
    setMyBookings(validBookings.map((booking) => ({ ...booking, trip_id: Number(booking.trip_id), rider_id: validUserId ? userId : null })));
    setBookingLoadError(errors.join(" "));
  }, [token, accountRole]);

  const approvedVehicles = useMemo<ApprovedVehicle[]>(() => applications.flatMap((app) => {
    if (app.status !== "approved" || !["car", "bike"].includes(app.vehicle_type)) return [];
    const onboarding = onboardings.find((row) => Number(row.car_id) === app.car_id && row.vehicle_type === app.vehicle_type && row.status === "approved");
    const capacity = onboarding?.legal_passenger_capacity;
    const validCapacity = Number.isSafeInteger(capacity) && capacity >= 1 && (app.vehicle_type === "bike" ? capacity === 1 : app.vehicle_type === "car");
    return onboarding && validCapacity ? [{ ...app, legal_passenger_capacity: capacity }] : [];
  }), [applications, onboardings]);
  const capacityReviewRequired = applications.some((app) => app.status === "approved" && !approvedVehicles.some((vehicle) => vehicle.car_id === app.car_id && vehicle.vehicle_type === app.vehicle_type));
  const capabilities = membership?.capabilities ?? {};

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    setCatalogError("");
    try {
      const [access, firstCatalog, owned, driverReview] = await Promise.all([
        api("mobility/membership/me", token),
        api("mobility/pickup-points?page_size=50", token),
        api("cars", token),
        api("mobility/driver-onboarding/me", token),
      ]);
      const catalogRows = [...rows(firstCatalog)];
      let cursor = firstCatalog?.next_cursor;
      for (let page = 0; cursor && page < 99; page++) {
        const next = await api(`mobility/pickup-points?page_size=50&after=${encodeURIComponent(String(cursor))}`, token);
        catalogRows.push(...rows(next));
        cursor = next?.next_cursor;
      }
      setMembership(access);
      setApplications(Array.isArray(access?.host_applications) ? access.host_applications : []);
      setOnboardings(rows(driverReview));
      setPoints(catalogRows.map((point) => ({ id: Number(point.id), name: point.name, lat: Number(point.lat), lng: Number(point.lng) })));
      setCars(rows(owned));
      void refreshBookings();
      if (cursor) setCatalogError("The pickup catalog is unusually large; some points were omitted. Ask the operator to review the catalog size.");
    } catch (e: any) {
      setError(e?.message || "Canonical pooling is unavailable.");
    } finally {
      setBusy(false);
    }
  }, [token, refreshBookings]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!studentPreview || mode === "bookings") return;
    setMapStatus("loading");
    return loadMapsSdk({
      fetchImpl: fetch,
      documentRef: document,
      google: (window as any).google,
      onReady: () => setMapStatus("ready"),
      onUnavailable: () => setMapStatus("unavailable"),
    });
  }, [mode, mapRetry]);

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setSearched(false); setMatches([]);
    try {
      if (capabilities.discover !== true) throw new Error("Approved college membership is required to search rides.");
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const pickup = Number(values.pickup_point_id); const dropoff = Number(values.dropoff_point_id);
      if (!pickup || !dropoff || pickup === dropoff) throw new Error("Choose two different pickup points.");
      const result = await api("mobility/pool-matches", token, "POST", {
        service_date: String(values.service_date), pickup_point_id: pickup, dropoff_point_id: dropoff,
        from_time: String(values.from_time), to_time: String(values.to_time), preferred_time: String(values.preferred_time),
        ...(values.vehicle_type ? { vehicle_type: String(values.vehicle_type) } : {}), page_size: 20,
      });
      setMatches(rows(result)); setSearched(true);
    } catch (e: any) { setError(e?.message || "Ride search failed."); }
    finally { setBusy(false); }
  }

  async function requestSeat(match: Json) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (capabilities.request !== true) throw new Error("Approved college membership is required to request a seat.");
      if (!requestKeys.current.has(match.match_id)) requestKeys.current.set(match.match_id, crypto.randomUUID());
      const result = await api(`mobility/pool-matches/${encodeURIComponent(match.match_id)}/requests`, token, "POST", {}, requestKeys.current.get(match.match_id));
      setNotice(Number(result?.data?.request_state) === 1 ? "Your seat is confirmed." : "Seat requested. The host must still accept it.");
      setMatches((current) => current.filter((item) => item.match_id !== match.match_id));
      setSearched(false);
      void refreshBookings();
    } catch (e: any) { setError(e?.message || "Seat request failed."); }
    finally { setBusy(false); }
  }

  async function decideRequest(request: Json, decision: "accept" | "reject") {
    setBusy(true); setError(""); setNotice("");
    try {
      const riderId = Number(request.user?.id ?? request.user_id);
      const tripId = Number(request.trip_id);
      if (!Number.isSafeInteger(riderId) || riderId < 1 || !Number.isSafeInteger(tripId) || tripId < 1) throw new Error("The request did not include valid rider and ride IDs.");
      await api(`trips/${tripId}/requests/${riderId}/${decision}`, token, "POST", {});
      setNotice(decision === "accept" ? "Seat request accepted." : "Seat request declined.");
      await refreshBookings();
    } catch (e: any) { setError(e?.message || "Could not update the seat request."); }
    finally { setBusy(false); }
  }

  async function cancelBooking(booking: Json) {
    setBusy(true); setError(""); setNotice("");
    try {
      const tripId = Number(booking.trip_id); const riderId = Number(booking.rider_id);
      if (!Number.isSafeInteger(tripId) || tripId < 1 || !Number.isSafeInteger(riderId) || riderId < 1) throw new Error("Your seat request has invalid ride or rider IDs, so it cannot be cancelled safely.");
      await api(`trips/${tripId}/requests/${riderId}/cancel`, token, "POST", {});
      setNotice("Your seat request was cancelled.");
      await refreshBookings();
    } catch (e: any) { setError(e?.message || "Could not cancel the seat request."); }
    finally { setBusy(false); }
  }

  async function getQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setQuote(undefined);
    try {
      if (capabilities.publish !== true) throw new Error("Approved membership and an operator approved host vehicle are required to publish.");
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const vehicle = approvedVehicles.find((app) => app.car_id === Number(values.car_id));
      if (!vehicle) throw new Error("Choose an operator approved vehicle.");
      const pickup = Number(values.pickup_point_id); const dropoff = Number(values.dropoff_point_id);
      if (!pickup || !dropoff || pickup === dropoff) throw new Error("Choose two different route points.");
      const result = await api("mobility/routes/quote", token, "POST", { pickup_point_id: pickup, dropoff_point_id: dropoff, vehicle_type: vehicle.vehicle_type });
      if (typeof result?.data?.id !== "string" || result.data.currency !== "INR" || !Number.isSafeInteger(result.data.seat_price_minor) || !Number.isFinite(Date.parse(result.data.expires_at))) throw new Error("The route service returned an invalid quote.");
      setQuote({ ...result.data, car_id: vehicle.car_id, legal_passenger_capacity: vehicle.legal_passenger_capacity });
    } catch (e: any) { setError(e?.message || "Could not get a route quote."); }
    finally { setBusy(false); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!quote) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const date = String(values.trip_date);
      const departure = new Date(`${date}:00+05:30`);
      if (!Number.isFinite(departure.getTime()) || departure.getTime() <= Date.now() + 15 * 60_000) throw new Error("Choose a departure at least 15 minutes from now (India time).");
      if (Date.parse(quote.expires_at) <= Date.now()) { setQuote(undefined); throw new Error("The route quote expired. Get a fresh quote."); }
      const seats = Number(values.total_seats);
      if (!Number.isSafeInteger(seats) || seats < 1 || seats > quote.legal_passenger_capacity) throw new Error(`Passenger seats must be between 1 and the reviewed vehicle capacity (${quote.legal_passenger_capacity}).`);
      const data = { quote_id: quote.id, car_id: quote.car_id, trip_date: date, total_seats: seats, description: String(values.description || "") };
      const signature = JSON.stringify(data);
      if (!publishAttempt.current || publishAttempt.current.signature !== signature) publishAttempt.current = { signature, key: crypto.randomUUID() };
      const result = await api("mobility/pool-offers", token, "POST", data, publishAttempt.current.key);
      const tripId = result?.data?.id ?? result?.data?.trip_id;
      if (!Number.isSafeInteger(Number(tripId)) || Number(tripId) < 1) throw new Error("The server response did not include a ride ID. Refresh your hosted rides before retrying.");
      setNotice(`Ride #${tripId} published. Riders can now request seats.`);
      setQuote(undefined); publishAttempt.current = undefined;
    } catch (e: any) { setError(e?.message || "Ride publication failed."); }
    finally { setBusy(false); }
  }

  const pointOptions = (label: string) => <option value="">{label}</option>;
  const price = (value: any) => `₹${(Number(value || 0) / 100).toFixed(2)}`;
  const pointName = (id: number) => points.find((point) => point.id === id)?.name || `Point ${id}`;
  const vehiclePart = (value: any) => typeof value === "string" ? value : typeof value?.name === "string" ? value.name : "";
  const localTime = (value: any) => Number.isFinite(Date.parse(String(value))) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Time unavailable";

  return <div className="canonical-pool">
    <div className="section-head"><div><p className="eyebrow">YOUR COMMUTE</p><h3>Share a ride or find a seat</h3></div><button type="button" className="secondary" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
    <p className="fine">Pick two stops from the campus route list to find rides. Drivers can publish a ride for those same stops.</p>
    {membership && process.env.NEXT_PUBLIC_CANONICAL_DEMO !== "1" && <p className="fine">Membership: <strong>{membership.membership?.status || "not applied"}</strong> · Discovery and requests: <strong>{capabilities.discover ? "enabled" : "approval required"}</strong> · Publishing: <strong>{capabilities.publish ? "enabled" : "host approval required"}</strong></p>}
    {catalogError && <p className="review-note">{catalogError}</p>}
    {error && <p className="error banner" role="alert">{error}</p>}{notice && <p className="banner" role="status">{notice}</p>}
    <div className="pool-tabs">{accountRole !== "driver" && <button className={mode === "find" ? "primary" : "secondary"} onClick={() => { if (mode !== "find") { setPickup(undefined); setDropoff(undefined); } setMode("find"); setError(""); setNotice(""); }}>Find a seat</button>}{accountRole !== "rider" && <button className={mode === "publish" ? "primary" : "secondary"} onClick={() => { setMode("publish"); setError(""); setNotice(""); }}>Publish a ride</button>}<button className={mode === "bookings" ? "primary" : "secondary"} onClick={() => { setMode("bookings"); setError(""); setNotice(""); void refreshBookings(); }}>Booking requests</button></div>

    {mode === "find" ? <>
      {!capabilities.discover && <p className="review-note">Ride discovery is available after an operator approves your college membership.</p>}
      <form className="form-grid pool-form" onSubmit={find}>
        <label>Travel date<input name="service_date" type="date" min={todayIndia()} defaultValue={todayIndia()} required /></label>
        <CanonicalPlacePicker token={token} label="Pickup point" name="pickup_point_id" points={points} disabled={busy} mapsReady={!studentPreview || mapStatus === "ready"} onSelect={setPickup} />
        <CanonicalPlacePicker token={token} label="Drop-off point" name="dropoff_point_id" points={points} disabled={busy} mapsReady={!studentPreview || mapStatus === "ready"} onSelect={setDropoff} />
        <details className="pool-search-options"><summary>Time and vehicle preferences <span>Optional</span></summary>
          <div className="form-grid pool-form pool-search-options-grid">
            <label>Earliest pickup<input name="from_time" type="time" defaultValue="00:00" required /></label>
            <label>Preferred pickup<input name="preferred_time" type="time" defaultValue="08:30" required /></label>
            <label>Latest pickup<input name="to_time" type="time" defaultValue="23:59" required /></label>
            <label>Vehicle<select name="vehicle_type" defaultValue=""><option value="">Any</option><option value="car">Car</option><option value="bike">Motorbike</option></select></label>
          </div>
        </details>
        <button className="primary wide" disabled={busy || !capabilities.discover || points.length < 2}>{busy ? "Searching…" : "Search available seats"}</button>
      </form>
      {studentPreview && mapStatus === "ready" && <CanonicalRouteMap points={points} pickup={pickup} dropoff={dropoff} />}
      {studentPreview && mapStatus === "unavailable" && <p className="review-note">Google Maps is unavailable. You can still choose pickup points by name. <button type="button" className="secondary" onClick={() => setMapRetry(value => value + 1)}>Retry Maps</button></p>}
      {points.length < 2 && !busy && <p className="review-note">Ride search is unavailable until campus pickup points are added.</p>}
      {searched && matches.length === 0 && <p className="empty">No rides match these pickup points and date. Try a different time or route.</p>}
      {!!matches.length && <div className="pool-results">{matches.map((match) => <article className="onboarding-panel pool-result" key={match.match_id}>
      <div><strong>{pointName(match.pickup_point_id)} → {pointName(match.dropoff_point_id)}</strong><p className="fine">Host: {match.host_name || "Host"} · Vehicle: {match.vehicle_label || (match.vehicle_type === "bike" ? "Motorbike" : "Car")}</p><p className="fine">Pickup {localTime(match.pickup_local)} IST · drop-off {localTime(match.dropoff_local)} IST · {Number(match.seats_available)} seat{Number(match.seats_available) === 1 ? "" : "s"} free · {price(match.seat_price_minor)} per passenger · no payment collected</p>{match.synthetic_only && <p className="review-note">Synthetic test quote</p>}</div>
        <button type="button" className="primary" disabled={busy || !capabilities.request || Number(match.seats_available) < 1} onClick={() => void requestSeat(match)}>Request one seat</button>
      </article>)}</div>}
    </> : mode === "publish" ? <>
      {!capabilities.publish && <p className="review-note">Publishing requires approved college membership and an operator approved vehicle. Start or review vehicle approval in Driver onboarding.</p>}
      <form className="form-grid pool-form" onSubmit={getQuote}>
        <label>Approved vehicle<select name="car_id" required defaultValue="">{pointOptions("Choose approved vehicle")}{approvedVehicles.map((app) => { const car = cars.find((item) => Number(item.id ?? item.car_id) === app.car_id); const name = car ? [vehiclePart(car.brand) || vehiclePart(car.brand_other), vehiclePart(car.model) || vehiclePart(car.model_other)].filter(Boolean).join(" ") : ""; return <option key={`${app.car_id}-${app.vehicle_type}`} value={app.car_id}>{app.vehicle_type === "bike" ? "Motorbike" : "Car"} #{app.car_id}{name ? ` · ${name}` : ""}</option>; })}</select></label>
        <CanonicalPlacePicker token={token} label="Pickup point" name="pickup_point_id" points={points} disabled={busy} />
        <CanonicalPlacePicker token={token} label="Drop-off point" name="dropoff_point_id" points={points} disabled={busy} />
        <button className="primary wide" disabled={busy || !capabilities.publish || approvedVehicles.length === 0 || points.length < 2}>{busy ? "Getting quote…" : "Get route quote"}</button>
      </form>
      {approvedVehicles.length === 0 && <p className="fine">No approved host vehicle with a reviewed passenger-seat capacity is available. Use Driver onboarding to complete or correct the capacity, then wait for operator review.</p>}
      {capacityReviewRequired && <p className="review-note">An approved host vehicle is missing a valid reviewed passenger-seat capacity. It cannot be used to publish until its driver-onboarding record is corrected and approved.</p>}
      {quote && <section className="onboarding-panel pool-quote"><h4>Server route quote</h4><p>{(Number(quote.distance_meters) / 1000).toFixed(1)} km · {Math.ceil(Number(quote.duration_seconds) / 60)} min · {price(quote.seat_price_minor)} quoted per passenger · no payment collected · expires {new Date(quote.expires_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p><p>Reviewed passenger capacity: {quote.legal_passenger_capacity}</p>{quote.synthetic_only && <p className="review-note">Synthetic test quote</p>}
        <form className="form-grid pool-form" onSubmit={publish}>
          <label>Departure date and time (India time)<input type="datetime-local" name="trip_date" min={earliestDepartureIndia()} required /></label>
          <label>Passenger seats<input type="number" name="total_seats" min="1" max={quote.legal_passenger_capacity} defaultValue="1" required /></label>
          <label className="wide">Notes (optional)<input type="text" name="description" maxLength={600} /></label>
          <button className="primary wide" disabled={busy}>{busy ? "Publishing…" : "Publish quoted ride"}</button>
        </form>
      </section>}
    </> : <section className="pool-results" aria-label="Booking requests">
      {bookingLoadError && <p className="error banner" role="alert">{bookingLoadError}</p>}
      {accountRole !== "rider" && <><h4>Requests for your rides</h4>
      {hostRequests.length === 0 && !bookingLoadError && <p className="empty">No pending seat requests for your rides.</p>}
      {hostRequests.map((request, index) => { const riderId = Number(request.user?.id ?? request.user_id); const validRiderId = Number.isSafeInteger(riderId) && riderId > 0; return <article className="onboarding-panel pool-result" key={`${request.trip_id}-${request.id ?? index}`}><div><strong>{request.user?.name || request.user?.first_name || `Rider ${validRiderId ? riderId : "unknown"}`}</strong><p className="fine">Ride #{request.trip_id} · requested {request.created_at ? new Date(request.created_at).toLocaleString("en-IN") : ""}</p></div><button className="primary" disabled={busy || !validRiderId} onClick={() => void decideRequest(request, "accept")}>Accept</button><button className="secondary" disabled={busy || !validRiderId} onClick={() => void decideRequest(request, "reject")}>Decline</button></article>; })}
      </>}{accountRole !== "driver" && <><h4>Your seat requests</h4>
      {myBookings.length === 0 && !bookingLoadError && <p className="empty">No active seat requests found.</p>}
      {myBookings.map((booking, index) => <article className="onboarding-panel pool-result" key={`${booking.trip_id}-${booking.id ?? index}`}><div><strong>Ride #{booking.trip_id}</strong><p className="fine">{Number(booking.request_state ?? booking.state) === 1 ? "Accepted" : "Pending host approval"}</p></div><button className="secondary" disabled={busy || !Number.isSafeInteger(Number(booking.rider_id)) || Number(booking.rider_id) < 1} onClick={() => void cancelBooking(booking)}>Cancel request</button></article>)}
      </>}</section>}
  </div>;
}
