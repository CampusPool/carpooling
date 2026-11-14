"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { loadMapsSdk } from "../lib/maps-loader.mjs";
import OlaPlaceInput from "./OlaPlaceInput";
import OlaMapPanel from "./OlaMapPanel";
import RideConversation from "./RideConversation";
import LiveAccountActivity from "./LiveAccountActivity";
import { api } from "../lib/commute-api";
import { initialCommuteSchedule, isFutureCommute, istDateTime } from "../lib/commute-time";
import styles from "./LiveCarpool.module.css";

type Json = Record<string, any>;
type Place = { lat: number; lng: number; label: string };
type Props = { token: string; accountRole?: "rider" | "driver"; savedProfile?: Json };
function validSavedPlace(value: any): Place | undefined {
  if (!value || typeof value.label !== "string" || !value.label.trim()) return undefined;
  const lat = Number(value.lat), lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 12.65 || lat > 13.35 || lng < 77.2 || lng > 77.95) return undefined;
  return { lat, lng, label: value.label.slice(0, 160) };
}
const rows = (v: any): Json[] => Array.isArray(v?.data) ? v.data : [];
const when = (s: string) => new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function PlaceInput({ label, ready, value, onChange, disabled }: { label: string; ready: boolean; value?: Place; onChange: (place?: Place) => void; disabled?: boolean }) {
  const [query, setQuery] = useState(value?.label || "");
  useEffect(() => { setQuery(value?.label || ""); }, [value?.label]);
  const [suggestions, setSuggestions] = useState<Json[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!ready || value || query.trim().length < 3) { setSuggestions([]); return; }
    const id = ++generation.current;
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const places = await (window as any).google.maps.importLibrary("places");
        const result = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query.trim(), includedRegionCodes: ["in"], locationBias: { south: 12.65, north: 13.35, west: 77.2, east: 77.95 } });
        if (generation.current === id) setSuggestions((result.suggestions || []).filter((s: Json) => s.placePrediction).slice(0, 5));
      } catch { if (generation.current === id) setError("Google address search is unavailable. Check Places API (New), billing and key restrictions; or select a point directly on the map."); }
      finally { if (generation.current === id) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timer); generation.current++; };
  }, [query, ready, value]);
  async function choose(prediction: Json) {
    const id = ++generation.current;
    setBusy(true); setSuggestions([]); setError("");
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "displayName", "location"] });
      if (generation.current !== id) return;
      const lat = place.location?.lat(), lng = place.location?.lng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw Error();
      if (lat < 12.65 || lat > 13.35 || lng < 77.2 || lng > 77.95) { setError("Choose a place in Bengaluru for this local service."); return; }
      const labelText = String(place.formattedAddress || place.displayName || prediction.text?.text || query).slice(0, 160);
      onChange({ lat, lng, label: labelText }); setQuery(labelText);
    } catch { if (generation.current === id) setError("Google could not resolve this place. Please choose it again."); }
    finally { if (generation.current === id) setBusy(false); }
  }
  return <div className={styles.place}>
    <label>{label}<input aria-label={label} value={query} placeholder={ready ? "Search for a place in Bengaluru" : "Loading Google Places…"} autoComplete="off" disabled={!ready || disabled} onChange={e => { generation.current++; setQuery(e.target.value); onChange(undefined); setError(""); }} /></label>
    {value && <small className={styles.selected}>✓ Place selected</small>}
    {busy && <small>Searching…</small>}
    {!!suggestions.length && <div className={styles.suggestions} role="listbox" aria-label={`${label} suggestions`}>{suggestions.map((s, i) => <button key={s.placePrediction.placeId || i} type="button" disabled={disabled} onClick={() => void choose(s.placePrediction)}>{String(s.placePrediction.text?.text || s.placePrediction.text || "Place")}</button>)}</div>}
    {error && <small role="alert">{error}</small>}
  </div>;
}

export default function LiveCarpool({ token, accountRole = "rider", savedProfile }: Props) {
  const useOlaMaps = process.env.NEXT_PUBLIC_MAP_PROVIDER === "ola";
  const isDriver = accountRole === "driver";
  const [origin, setOrigin] = useState<Place | undefined>(() => validSavedPlace(savedProfile?.home));
  const [destination, setDestination] = useState<Place | undefined>(() => validSavedPlace(savedProfile?.campus));
  const [date, setDate] = useState(() => initialCommuteSchedule(savedProfile?.outbound_time).date);
  const [time, setTime] = useState(() => initialCommuteSchedule(savedProfile?.outbound_time).time);
  const [sameGenderOnly, setSameGenderOnly] = useState<boolean>(() => Boolean(savedProfile?.same_gender_only));
  const [genderIdentity, setGenderIdentity] = useState<string>(() => savedProfile?.gender_identity || "");
  const [ready, setReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapPick, setMapPick] = useState<"origin" | "destination" | null>(null);
  const [mapError, setMapError] = useState("");
  const [retry, setRetry] = useState(0);
  const [routeSummary, setRouteSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rides, setRides] = useState<Json[]>([]);
  const [offers, setOffers] = useState<Json[]>([]);
  const [bookings, setBookings] = useState<Json[]>([]);
  const [notifications, setNotifications] = useState<Json[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);
  const [searched, setSearched] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");
  const [activeTrip, setActiveTrip] = useState<number>();
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (savedProfile?.same_gender_only !== undefined) {
      setSameGenderOnly(Boolean(savedProfile.same_gender_only));
    }
    if (savedProfile?.gender_identity) {
      setGenderIdentity(savedProfile.gender_identity);
    }
  }, [savedProfile?.same_gender_only, savedProfile?.gender_identity]);

  const displayGender = genderIdentity === "man" || genderIdentity === "male"
    ? "Male"
    : genderIdentity === "woman" || genderIdentity === "female"
    ? "Female"
    : genderIdentity === "non_binary" || genderIdentity === "other"
    ? "Other"
    : genderIdentity;
  const mapRoot = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const mapPickRef = useRef<"origin" | "destination" | null>(null);
  mapPickRef.current = mapPick;
  const overlays = useRef<any[]>([]);
  const mounted = useRef(true);
  const attempts = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([api("bookings", token), api("notifications", token), isDriver ? api("offers", token) : Promise.resolve({ data: [] })]);
    if (!mounted.current) return;
    if (results[0].status === "fulfilled") setBookings(rows(results[0].value));
    if (results[1].status === "fulfilled") { setNotifications(rows(results[1].value)); setUnreadCount(Number(results[1].value.unread_count || 0)); }
    if (results[2].status === "fulfilled") setOffers(rows(results[2].value));
    const failed = results.find(r => r.status === "rejected");
    setLoadError(failed?.status === "rejected" ? failed.reason?.message || "Ride updates could not load." : "");
  }, [token, isDriver]);
  useEffect(() => { mounted.current = true; void refresh(); const timer = setInterval(() => void refresh(), 8000); return () => { mounted.current = false; clearInterval(timer); }; }, [refresh]);
  useEffect(() => {
    if (useOlaMaps) return;
    setReady(false); setMapError("");
    return loadMapsSdk({ fetchImpl: fetch, documentRef: document, google: (window as any).google, onReady: () => setReady(true), onUnavailable: (message: string) => setMapError(message) });
  }, [retry, useOlaMaps]);
  useEffect(() => {
    if (useOlaMaps || !ready || !mapRoot.current) return;
    setMapReady(false);
    let active = true;
    void (async () => {
      try {
        const g = (window as any).google;
        const lib = await g.maps.importLibrary("maps");
        if (!active || !mapRoot.current) return;
        map.current = new lib.Map(mapRoot.current, { center: { lat: 12.9716, lng: 77.5946 }, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
        map.current.addListener("click", (event: any) => {
          const target = mapPickRef.current;
          if (!target || !event.latLng) return;
          const lat = event.latLng.lat(), lng = event.latLng.lng();
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 12.65 || lat > 13.35 || lng < 77.2 || lng > 77.95) {
            setMapError("Select a point inside the Bengaluru service area."); return;
          }
          const place = { lat, lng, label: `Map point (${lat.toFixed(5)}, ${lng.toFixed(5)})` };
          if (target === "origin") setOrigin(place); else setDestination(place);
          setRides([]); setSearched(false); setSearchFeedback(""); setMapPick(null); setMapError("");
        });
        setMapReady(true);
      } catch { if (active) setMapError("The Google map could not load. Retry Maps."); }
    })();
    return () => { active = false; };
  }, [ready, useOlaMaps]);
  useEffect(() => {
    if (useOlaMaps) return;
    if (!origin || !destination) {
      overlays.current.forEach(o => o.setMap(null)); overlays.current = [];
      setRouteSummary(""); return;
    }
    if (!ready || !mapReady) return;
    let active = true;
    overlays.current.forEach(o => o.setMap(null)); overlays.current = [];
    setRouteSummary("Finding a driving route…");
    void (async () => {
      try {
        const g = (window as any).google;
        await g.maps.importLibrary("routes");
        const response = await g.maps.routes.Route.computeRoutes({ origin: { location: { lat: origin.lat, lng: origin.lng } }, destination: { location: { lat: destination.lat, lng: destination.lng } }, travelMode: "DRIVING", fields: ["path", "distanceMeters", "durationMillis", "warnings"] });
        if (!active) return;
        const route = response.routes?.[0];
        if (!route?.path?.length) throw Error();
        overlays.current.forEach(o => o.setMap(null));
        const line = new g.maps.Polyline({ map: map.current, path: route.path, strokeColor: "#176b5b", strokeWeight: 5 });
        const bounds = new g.maps.LatLngBounds(); route.path.forEach((p: any) => bounds.extend(p)); map.current?.fitBounds(bounds, 54);
        overlays.current = [line];
        if (g.maps.Marker) overlays.current.push(new g.maps.Marker({ map: map.current, position: { lat: origin.lat, lng: origin.lng }, label: "A", title: origin.label }), new g.maps.Marker({ map: map.current, position: { lat: destination.lat, lng: destination.lng }, label: "B", title: destination.label }));
        setRouteSummary(`${(route.distanceMeters / 1000).toFixed(1)} km · about ${Math.max(1, Math.round(route.durationMillis / 60000))} min driving${route.warnings?.length ? ` · ${route.warnings.join(" ")}` : ""}`);
      } catch { if (active) setRouteSummary("Google route preview is unavailable. Your selected places are retained."); }
    })();
    return () => { active = false; };
  }, [origin, destination, ready, mapReady, useOlaMaps]);
  async function mutate(path: string, body: Json) {
    const signature = path + JSON.stringify(body);
    const key = attempts.current.get(signature) || crypto.randomUUID(); attempts.current.set(signature, key);
    const data = await api(path, token, "POST", body, key); attempts.current.delete(signature); return data;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!origin || !destination) { setError("Select your pickup and destination from map suggestions or the map."); return; }
    if (origin.lat === destination.lat && origin.lng === destination.lng) { setError("Choose different pickup and destination places."); return; }
    if (!isFutureCommute(date, time)) { setError("Choose a future departure at least 15 minutes from now (India Standard Time)."); return; }
    if (sameGenderOnly && !genderIdentity) { setError("Please select your gender to enable same-gender matching."); return; }
    setBusy(true);
    try {
      await api("profile", token, "PUT", {
        role: accountRole,
        vehicle_preference: "car",
        schedule_mode: "custom",
        home: origin,
        campus: destination,
        outbound_time: time,
        return_time: time,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        max_walk_meters: 999,
        same_gender_only: sameGenderOnly,
        ...(genderIdentity ? { gender_identity: genderIdentity } : {}),
      });
      if (isDriver) {
        await mutate("offers", { direction: "outbound", date, vehicle_type: "car", choice: "DIRECT_RIDER_PICKUP", max_detour_meters: 3000, max_detour_seconds: 600 });
        setNotice(sameGenderOnly ? "Ride published with same-gender requests only. Riders of your gender can now find it and request a seat." : "Ride published. Riders can now find it and request a seat.");
        await refresh();
      } else {
        const result = await api(`rides?direction=outbound&date=${encodeURIComponent(date)}&vehicle_type=both&pickup_choice=both`, token);
        const found = rows(result);
        const reasons = Array.isArray(result?.excluded) ? result.excluded.map((item: Json) => String(item?.reason || "")) : [];
        setRides(found);
        setSearchFeedback(found.length ? ""
          : reasons.some((reason: string) => ["NO_COMPATIBLE_JOURNEY_WITHIN_LIMITS", "ROUTE_DIRECTION_INCOMPATIBLE", "NO_ROUTE", "ROUTE_INVALID"].includes(reason))
            ? "Some driver rides were found, but their road route, walking distance or detour limits do not fit these pickup and destination places. Try a nearby road-accessible pickup point."
            : reasons.includes("PICKUP_TIME_MISMATCH")
              ? "Driver rides were found, but their pickup times do not fit your preferred time. Try another departure time."
              : sameGenderOnly
                ? "No matching rides from drivers of the same gender found for this route and time. Try adjusting your departure time or search without same-gender restriction."
                : "");
        setSearched(true);
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function joinWaitlist(ride: Json) {
    setBusy(true); setError(""); setNotice("");
    try { await mutate(`rides/${ride.trip_id}/waitlist`, { quote_token: ride.quote_token }); setNotice("Joined the waitlist. This does not reserve a seat; check your waitlist below for openings."); setRides(current => current.filter(item => item.trip_id !== ride.trip_id)); setActivityVersion(current => current + 1); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function requestRide(ride: Json) {
    setBusy(true); setError(""); setNotice("");
    try { await mutate(`rides/${ride.trip_id}/request`, { quote_token: ride.quote_token }); setRides(current => current.filter(item => item.trip_id !== ride.trip_id)); setNotice("Seat requested. The driver has been notified."); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function action(booking: Json, actionName: string) {
    setBusy(true); setError(""); setNotice("");
    try { await mutate(`bookings/${booking.booking_id}/${actionName}`, {}); setNotice(actionName === "accept" ? "Request accepted. Your rider has been notified; you can now chat." : actionName === "reject" ? "Request declined." : "Booking cancelled."); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function paymentAction(path: string, message: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await mutate(path, {});
      await refresh();
      // Wallet holds/refunds/releases are account-scoped and should refresh
      // alongside the booking, not wait for a periodic wallet poll.
      setActivityVersion(current => current + 1);
      setNotice(message);
    } catch (e: any) { setError(e?.message || "The demo payment action failed."); }
    finally { setBusy(false); }
  }
  async function transition(booking: Json, actionName: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await mutate(`trips/${booking.trip_id}/transition`, { action: actionName, ...(["board", "alight"].includes(actionName) ? { passenger_id: Number(booking.rider_id) } : {}) });
      setNotice(({ start: "Ride started.", board: "Rider marked as picked up.", alight: "Rider marked as dropped off.", complete: "Ride completed." } as Record<string, string>)[actionName]);
      await refresh();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const selectedBooking = bookings.find(b => b.trip_id === activeTrip && Number(b.request_state) === 1 && !["completed", "cancelled"].includes(b.state));
  return <div className={styles.shell}>
    <div className={styles.intro}><div><p className={styles.eyebrow}>{isDriver ? "DRIVER" : "RIDER"} · BENGALURU</p><h2>{isDriver ? "Offer your next ride" : "Find your next ride"}</h2><p>{isDriver ? "Choose your route and departure time. Accept requests from riders going your way." : "Choose where you want to go and when. Request a seat from a driver going your way."}</p></div></div>
    <div className={styles.planner}>
      <form className={styles.form} onSubmit={submit}>
        {useOlaMaps
          ? <><OlaPlaceInput label="Pickup place" token={token} ready={ready} value={origin} disabled={busy} onChange={place => { setOrigin(place); setRides([]); setSearched(false); setSearchFeedback(""); }} />
              <OlaPlaceInput label="Destination place" token={token} ready={ready} value={destination} disabled={busy} onChange={place => { setDestination(place); setRides([]); setSearched(false); setSearchFeedback(""); }} /></>
          : <><PlaceInput label="Pickup place" ready={ready} value={origin} disabled={busy} onChange={place => { setOrigin(place); setRides([]); setSearched(false); setSearchFeedback(""); }} />
              <PlaceInput label="Destination place" ready={ready} value={destination} disabled={busy} onChange={place => { setDestination(place); setRides([]); setSearched(false); setSearchFeedback(""); }} /></>}
        <div className={styles.timeRow}>
          <button type="button" disabled={!mapReady || busy} aria-pressed={mapPick === "origin"} onClick={() => setMapPick(v => v === "origin" ? null : "origin")}>Choose pickup on map</button>
          <button type="button" disabled={!mapReady || busy} aria-pressed={mapPick === "destination"} onClick={() => setMapPick(v => v === "destination" ? null : "destination")}>Choose destination on map</button>
        </div>
        {mapPick && <small role="status">Click a road-accessible point on the map to set your {mapPick === "origin" ? "pickup" : "destination"}. This works when address suggestions are unavailable.</small>}
        <div className={styles.timeRow}><label>Travel date<input required disabled={busy} type="date" value={date} min={istDateTime(new Date()).date} onChange={e => { setDate(e.target.value); setRides([]); setSearched(false); setSearchFeedback(""); }} /></label><label>{isDriver ? "Departure time" : "Preferred pickup time"}<input required disabled={busy} type="time" value={time} onChange={e => { setTime(e.target.value); setRides([]); setSearched(false); setSearchFeedback(""); }} /></label></div>
        <small>Times are in India Standard Time. Rider search includes pickups within 15 minutes of your chosen time.</small>
        <div className={styles.genderSection}>
          <div className={styles.genderRow}>
            <button
              type="button"
              className={sameGenderOnly ? styles.genderButtonActive : styles.genderButton}
              aria-pressed={sameGenderOnly}
              disabled={busy}
              onClick={() => {
                setSameGenderOnly(v => !v);
                setRides([]);
                setSearched(false);
                setSearchFeedback("");
              }}
            >
              {sameGenderOnly ? "✓ " : ""}
              {isDriver ? "Same gender requests only" : "Same gender rides only"}
            </button>
            {displayGender ? (
              <span className={styles.genderBadge}>Your gender: {displayGender}</span>
            ) : (
              <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#38535b" }}>
                Gender:
                <select
                  className={styles.genderSelect}
                  value={genderIdentity}
                  disabled={busy}
                  onChange={e => {
                    setGenderIdentity(e.target.value);
                    setRides([]);
                    setSearched(false);
                    setSearchFeedback("");
                  }}
                >
                  <option value="">Select gender</option>
                  <option value="man">Male</option>
                  <option value="woman">Female</option>
                  <option value="non_binary">Other</option>
                </select>
              </label>
            )}
          </div>
          <small>{isDriver ? "When active, you receive ride requests only from riders of your same gender." : "When active, you receive ride recommendations only from drivers of your same gender."}</small>
        </div>
        <button className={styles.primary} type="submit" disabled={busy || !ready}>{busy ? "Please wait…" : isDriver ? "Publish ride" : "Find rides"}</button>
        {mapError && <div role="alert">{mapError} <button type="button" onClick={() => setRetry(v => v + 1)}>Retry Maps</button></div>}
      </form>
      {useOlaMaps
        ? <OlaMapPanel key={retry} token={token} origin={origin} destination={destination} pick={mapPick}
            onPick={(kind, place) => { if (kind === "origin") setOrigin(place); else setDestination(place); setMapPick(null); setRides([]); setSearched(false); setSearchFeedback(""); }}
            onState={isReady => { setReady(isReady); setMapReady(isReady); }} onError={setMapError} />
        : <div className={styles.mapPanel}><div ref={mapRoot} className={styles.map} aria-label="Google map of your selected route" /><p>{routeSummary || "Select your pickup and destination to see the driving route on Google Maps."}</p></div>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.columns}>
      <section><div className={styles.sectionTitle}><h3>{isDriver ? "Your published rides" : "Available rides"}</h3><button type="button" onClick={() => void refresh()}>Refresh updates</button></div>
        {isDriver && !offers.length && <p>Your published rides will appear here.</p>}
        {!isDriver && searched && !rides.length && <p>{searchFeedback || "No matching rides yet. Check that your date, pickup and destination match the driver’s route, and choose a pickup time within 15 minutes of departure."}</p>}
        {!isDriver && !searched && <p>Your matching rides will appear here.</p>}
        {(isDriver ? offers : rides).map(ride => <article className={styles.card} key={`${ride.trip_id}-${ride.quote_token || "offer"}`}><div className={styles.cardHead}><strong>{isDriver ? `Ride #${ride.trip_id}` : ride.driver_name}</strong><span>{ride.seats_available} seat{Number(ride.seats_available) === 1 ? "" : "s"} available</span></div><p className={styles.route}>{ride.pickup_label}<span>↓</span>{ride.dropoff_label}</p><p>{when(ride.departure_at)}</p>{!isDriver && Number(ride.seats_available) < 1 && ride.waitlist_available && <button type="button" disabled={busy} onClick={() => void joinWaitlist(ride)}>Join waitlist</button>}{!isDriver && <button type="button" className={styles.primary} disabled={busy || Number(ride.seats_available) < 1 || bookings.some(b => b.trip_id === ride.trip_id && [0, 1].includes(Number(b.request_state)))} onClick={() => void requestRide(ride)}>{bookings.some(b => b.trip_id === ride.trip_id && [0, 1].includes(Number(b.request_state))) ? "Requested" : "Request seat"}</button>}</article>)}
      </section>
      <section><div className={styles.sectionTitle}><h3>{isDriver ? "Rider requests" : "Your requests"}</h3></div>{loadError && <p role="alert">{loadError}</p>}{!bookings.length && <p>{isDriver ? "New rider requests appear here automatically." : "Your requested rides and driver responses appear here."}</p>}
        {bookings.map(booking => {
          const accepted = Number(booking.request_state) === 1;
          const terminal = ["completed", "cancelled"].includes(booking.state);
          const planned = !booking.state || booking.state === "planned";
          const progress = booking.state === "completed" ? "Ride completed" : booking.state === "cancelled" ? "Ride cancelled" : booking.state === "in_progress" ? booking.participant_state === "alighted" ? "Dropped off" : booking.participant_state === "boarded" ? "On the way" : "Driver on the way" : undefined;
          return <article className={styles.card} key={booking.booking_id}>
            <div className={styles.cardHead}><strong>{isDriver ? booking.rider_name : booking.driver_name}</strong><span className={accepted && !terminal ? styles.accepted : ""}>{(accepted && progress) || ["Awaiting driver", "Accepted", "Declined", "Cancelled"][Number(booking.request_state)] || "Updated"}</span></div>
            <p className={styles.route}>{booking.pickup_label}<span>↓</span>{booking.dropoff_label}</p><p>{when(booking.departure_at)} · Ride #{booking.trip_id}</p>
            <p>Demo fare ₹{(Number(booking.fare_minor || 0) / 100).toFixed(2)} · {({ unpaid: "Payment awaiting confirmation", held: "Demo credits held", refunded: "Demo credits refunded", released: "Demo credits released" } as Record<string, string>)[booking.wallet_state] || "Demo payment status pending"}</p>
            <div className={styles.actions}>
              {isDriver && Number(booking.request_state) === 0 && planned && <><button type="button" className={styles.primary} disabled={busy} onClick={() => void action(booking, "accept")}>Accept rider</button><button type="button" disabled={busy} onClick={() => void action(booking, "reject")}>Decline</button></>}
              {!isDriver && accepted && planned && booking.wallet_state === "unpaid" && <button type="button" className={styles.primary} disabled={busy} onClick={() => void paymentAction(`bookings/${booking.booking_id}/pay`, "Demo credits held for this booking. This is not a real payment.")}>Confirm demo payment</button>}
              {accepted && !terminal && <button type="button" className={styles.primary} onClick={() => setActiveTrip(booking.trip_id)}>Chat & location</button>}
              {isDriver && accepted && planned && <button type="button" disabled={busy} onClick={() => void transition(booking, "start")}>Start ride</button>}
              {isDriver && accepted && booking.state === "in_progress" && !["boarded", "alighted"].includes(booking.participant_state) && <button type="button" disabled={busy} onClick={() => void transition(booking, "board")}>Mark rider picked up</button>}
              {isDriver && accepted && booking.state === "in_progress" && booking.participant_state === "boarded" && <button type="button" disabled={busy} onClick={() => void transition(booking, "alight")}>Mark rider dropped off</button>}
              {isDriver && accepted && booking.state === "in_progress" && booking.participant_state === "alighted" && <button type="button" disabled={busy} onClick={() => void transition(booking, "complete")}>Complete ride</button>}
              {[0, 1].includes(Number(booking.request_state)) && planned && <button type="button" disabled={busy} onClick={() => void action(booking, "cancel")}>Cancel booking</button>}
              {!isDriver && accepted && booking.state === "completed" && booking.wallet_state === "held" && !booking.rider_arrived_at && <button type="button" disabled={busy} onClick={() => void paymentAction(`bookings/${booking.booking_id}/confirm-arrival`, "Arrival confirmed. Demo credit release follows the server's waiting period.")}>Confirm arrival</button>}
              {isDriver && accepted && booking.wallet_state === "held" && booking.release_at && <button type="button" disabled={busy} onClick={() => void paymentAction("wallet/release-due", "Checked pending demo credit releases.")}>Check credit release</button>}
              {isDriver && accepted && booking.wallet_state === "released" && !booking.receipt && <button type="button" disabled={busy} onClick={() => void paymentAction(`bookings/${booking.booking_id}/confirm-payment-received`, "Synthetic receipt recorded. No real money was exchanged.")}>Confirm demo payment received</button>}
            </div>
            {booking.receipt && <p role="status">Demo receipt {booking.receipt.receipt_number} · synthetic, non-redeemable credit</p>}
          </article>;
        })}
      </section>
    </div>
    <LiveAccountActivity key={`${token}-${activityVersion}`} token={token} role={accountRole} notifications={notifications} unreadCount={unreadCount} onRefresh={refresh} />
    {selectedBooking && <section className={styles.conversation}><div className={styles.sectionTitle}><h3>Ride #{activeTrip} · Chat & location</h3><button type="button" onClick={() => setActiveTrip(undefined)}>Close</button></div><RideConversation token={token} tripId={Number(activeTrip)} isDriver={isDriver} /></section>}
  </div>;
}
