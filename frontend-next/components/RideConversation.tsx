"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./RideConversation.module.css";

type Message = { id: number; user_id: number; text: string; created_at: string };
type Participant = { id: number; name: string };
type Location = { lat: number; lng: number; accuracy_meters: number; recorded_at: string };
async function api(token: string, tripId: number, path: string, body?: unknown, key?: string) {
  const response = await fetch(`/api/mobility/trips/${tripId}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key || crypto.randomUUID() }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || result?.error?.code?.replaceAll("_", " ") || "The ride could not be updated. Please try again.");
  return result.data ?? result;
}

export default function RideConversation({ token, tripId, isDriver }: { token: string; tripId: number; isDriver: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const generation = useRef(0);
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const watch = useRef<number | null>(null);
  const session = useRef<string | null>(null);
  const sequence = useRef(0);
  const uploading = useRef(false);
  const sendKey = useRef<{ text: string; key: string } | null>(null);
  const lastUploaded = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    let stopped = false;
    let refreshing = false;
    setMessages([]); setParticipants([]); setCanSend(false); setDraft(""); setLocation(null); setChatError(""); setTrackingError(""); setSharing(false); setStarting(false); setSending(false);
    sendKey.current = null; map.current = null; marker.current = null;
    async function refresh() {
      if (refreshing || stopped) return;
      refreshing = true;
      try {
        const data = await api(token, tripId, "messages");
        if (stopped || generation.current !== current) return;
        setMessages(data.messages || []); setParticipants(data.participants || []); setCanSend(data.can_send === true); setChatError("");
        const last = data.messages?.at(-1)?.id;
        if (last) void api(token, tripId, "messages/read", { through_id: last }).catch(() => {});
      } catch (error) { if (!stopped && generation.current === current) { setChatError((error as Error).message); setCanSend(false); } }
      try {
        const data = await api(token, tripId, "tracking");
        if (!stopped && generation.current === current) { setLocation(data.location || null); }
      } catch (error) { if (!stopped && generation.current === current) { setLocation(null); setTrackingError((error as Error).message); } }
      finally { refreshing = false; }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => {
      stopped = true; generation.current++;
      clearInterval(timer);
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
      const oldSession = session.current; session.current = null;
      if (oldSession) void api(token, tripId, "tracking/stop", { session_id: oldSession }).catch(() => {});
    };
  }, [token, tripId, isDriver]);

  useEffect(() => {
    if (!location) {
      marker.current?.setMap(null); marker.current = null; map.current = null;
      return;
    }
    if (!mapElement.current) return;
    const g = (window as any).google;
    if (!g?.maps?.Map || !g?.maps?.Marker) { setMapUnavailable(true); return; }
    setMapUnavailable(false);
    const position = { lat: location.lat, lng: location.lng };
    try {
      if (!map.current) map.current = new g.maps.Map(mapElement.current, { center: position, zoom: 15, mapTypeControl: false, streetViewControl: false });
      if (!marker.current) marker.current = new g.maps.Marker({ position, map: map.current, title: "Driver's shared location" });
      else marker.current.setPosition(position);
      map.current.panTo(position);
    } catch { setMapUnavailable(true); }
  }, [location]);

  async function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim();
    if (!text || !canSend || sending) return;
    const current = generation.current;
    const key = sendKey.current?.text === text ? sendKey.current.key : crypto.randomUUID();
    sendKey.current = { text, key }; setSending(true); setChatError("");
    try {
      const message = await api(token, tripId, "messages", { text }, key);
      if (generation.current !== current) return;
      setMessages((rows) => [...rows.filter((row) => row.id !== message.id), message]); setDraft(""); sendKey.current = null;
    } catch (error) { if (generation.current === current) setChatError((error as Error).message); }
    finally { if (generation.current === current) setSending(false); }
  }

  async function stopSharing(preserveError = false) {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    const old = session.current; session.current = null; setSharing(false); setLocation(null);
    if (old) {
      try { await api(token, tripId, "tracking/stop", { session_id: old }); if (!preserveError) setTrackingError(""); }
      catch (error) { setTrackingError(`Location capture stopped. Server update failed: ${(error as Error).message}`); }
    }
  }

  async function startSharing() {
    if (starting || sharing) return;
    if (!navigator.geolocation) { setTrackingError("This browser does not support location sharing."); return; }
    setStarting(true); setTrackingError("");
    const current = generation.current;
    try {
      const data = await api(token, tripId, "tracking/session", { consent: true });
      if (generation.current !== current) { void api(token, tripId, "tracking/stop", { session_id: data.session_id }).catch(() => {}); return; }
      session.current = data.session_id; sequence.current = 0; lastUploaded.current = 0; uploading.current = false;
      setSharing(true);
      watch.current = navigator.geolocation.watchPosition(async (position) => {
        if (generation.current !== current || !session.current || uploading.current || position.timestamp <= lastUploaded.current) return;
        if (position.coords.accuracy > 500) { setTrackingError("Waiting for a more accurate GPS location (within 500 m)."); return; }
        if (lastUploaded.current && position.timestamp - lastUploaded.current < 4000) return;
        const activeSession = session.current;
        uploading.current = true;
        try {
          await api(token, tripId, "tracking/locations", {
            session_id: activeSession, sequence: ++sequence.current, lat: position.coords.latitude, lng: position.coords.longitude,
            accuracy_meters: Math.max(1, position.coords.accuracy), recorded_at: new Date(position.timestamp).toISOString(),
          });
          if (generation.current !== current || session.current !== activeSession) return;
          lastUploaded.current = position.timestamp; setTrackingError("");
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy_meters: position.coords.accuracy, recorded_at: new Date(position.timestamp).toISOString() });
        } catch (error) { if (generation.current === current && session.current === activeSession) setTrackingError((error as Error).message); }
        finally { uploading.current = false; }
      }, (error) => {
        if (generation.current !== current) return;
        setTrackingError(error.code === 1 ? "Location permission was denied. Allow location access and try again." : "GPS could not get your location. Please try again.");
        void stopSharing(true);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    } catch (error) { if (generation.current === current) setTrackingError((error as Error).message); }
    finally { if (generation.current === current) setStarting(false); }
  }

  return <section className={styles.panel} aria-label={`Ride ${tripId} conversation and tracking`}>
    <div className={styles.header}><div><small>YOUR CONFIRMED RIDE</small><h3>Chat and meet up</h3></div><span>Ride #{tripId}</span></div>
    <div className={styles.messages} role="log" aria-label="Ride messages" aria-live="polite">
      {!messages.length && <p>Send a message to arrange your pickup.</p>}
      {messages.map((message) => <div className={styles.message} key={message.id}><strong>{participants.find((person) => person.id === message.user_id)?.name || "Ride participant"}</strong><p>{message.text}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>)}
    </div>
    {chatError && <p role="alert">{chatError}</p>}
    <form className={styles.composer} onSubmit={send}><label className={styles.inputLabel}>Message<input value={draft} maxLength={800} onChange={(event) => setDraft(event.target.value)} placeholder="Where should we meet?" disabled={!canSend || sending} /></label><button disabled={!canSend || sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button></form>
    {!canSend && !chatError && <small>Chat is available to the driver and confirmed riders while the ride is open.</small>}
    <div className={styles.tracking}><h4>Driver location</h4><p>{location ? `Updated ${new Date(location.recorded_at).toLocaleTimeString()} · accurate to ${Math.round(location.accuracy_meters)} m` : "No recent driver location. The driver can share it from this screen."}</p>
      {isDriver && <><p className={styles.fine}>Share your live GPS location with confirmed riders. Keep this page open; stop sharing whenever you want.</p><button type="button" disabled={starting} onClick={() => void (sharing ? stopSharing() : startSharing())}>{starting ? "Starting…" : sharing ? "Stop sharing location" : "Share my live location"}</button></>}
      {trackingError && <p role="alert">{trackingError}</p>}
      {location && <><div ref={mapElement} className={styles.map} aria-label="Driver location on Google Maps" />{mapUnavailable && <p>Google Maps is unavailable. Driver location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}.</p>}</>}
    </div>
  </section>;
}
