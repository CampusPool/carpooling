"use client";

import "./offer-management.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { driverAction } from "../lib/gates";
import { loadMapsSdk } from "../lib/maps-loader.mjs";
import DriverOnboarding from "../components/DriverOnboarding";
type R = Record<string, any>;
const list = (x: any) =>
  Array.isArray(x?.data) ? x.data : Array.isArray(x) ? x : [];
const tomorrowInKolkata = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 864e5));
const cash = (x: any) => `₹${(Number(x || 0) / 100).toFixed(2)}`;
const meters = (x: any) =>
  typeof x === "number" && Number.isFinite(x) ? `${Math.round(x)} m` : null;
const durationMinutes = (ride: R) => {
  if (typeof ride.duration_minutes === "number") return ride.duration_minutes;
  if (typeof ride.ride_seconds === "number" && ride.ride_seconds >= 0) {
    return Math.ceil(ride.ride_seconds / 60);
  }
  return null;
};
const instant = (x: any) =>
  typeof x === "string" && x && Number.isFinite(Date.parse(x))
    ? new Date(x).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
const pickupWindow = (ride: R) => {
  const earliest = instant(ride.pickup_window?.earliest);
  const latest = instant(ride.pickup_window?.latest);
  if (earliest && latest) return `${earliest} – ${latest}`;
  return instant(ride.departure_at);
};
const pickupChoiceLabel = (choice: string) =>
  choice === "ON_ROUTE_MEETING_POINT" ? "Meet along my route" : "Direct pickup";
async function request(
  path: string,
  token: string,
  method = "GET",
  json?: R,
  key?: string,
) {
  const h = new Headers({ Accept: "application/json" });
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (json) {
    h.set("Content-Type", "application/json");
    h.set("Idempotency-Key", key || crypto.randomUUID());
  }
  const endpoint = path.startsWith("admin/") ? `/api/${path}` : `/api/mobility/${path}`;
  const r = await fetch(endpoint, {
    method,
    headers: h,
    body: json ? JSON.stringify(json) : undefined,
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    {
      const code = typeof d.error?.code === "string" ? d.error.code : undefined;
      const messages: Record<string, string> = {
        WAITLIST_NOT_ACTIONABLE: "This waitlist entry is not actionable yet. Refresh when a seat may be available.",
        WAITLIST_NOT_YOUR_TURN: "An earlier rider is still waiting. Refresh the waitlist later.",
        COMMUTE_QUOTE_CHANGED: "Your route or fare changed. Refresh the terms before continuing.",
        COMMUTE_BUSY_RETRY: "The ride is being updated. Please retry.",
      };
      const message = (code && messages[code]) || (typeof d.message === "string" ? d.message : undefined) || (typeof d.error?.message === "string" ? d.error.message : undefined) || (typeof d.error === "string" ? d.error : undefined) || "Request failed. Please try again.";
      const error = Error(message);
      (error as Error & { status?: number }).status = r.status;
      if (r.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("mobility:unauthorized"));
      }
      throw error;
    }
  return d;
}
export default function Page() {
  const [token, setToken] = useState(""),
    [role, setRole] = useState("rider"),
    [adminEmail, setAdminEmail] = useState(""),
    [adminPassword, setAdminPassword] = useState(""),
    [me, setMe] = useState<R>(),
    [rides, setRides] = useState<R[]>([]),
    [scanTruncated, setScanTruncated] = useState(false),
    [waitlist, setWaitlist] = useState<R[]>([]),
    [waitlistQuotes, setWaitlistQuotes] = useState<Record<string, string>>({}),
    [waitlistTerms, setWaitlistTerms] = useState<Record<string, R>>({}),
    [bookings, setBookings] = useState<R[]>([]),
    [notifications, setNotifications] = useState<R[]>([]),
    [notificationUnread, setNotificationUnread] = useState(0),
    [notificationsUnavailable, setNotificationsUnavailable] = useState(false),
    [offers, setOffers] = useState<R[]>([]),
    [offersBusy, setOffersBusy] = useState(false),
    [wallet, setWallet] = useState<R>(),
    [bookingsUnavailable, setBookingsUnavailable] = useState(false),
    [walletUnavailable, setWalletUnavailable] = useState(false),
    [offersUnavailable, setOffersUnavailable] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle"),
    [mapError, setMapError] = useState(""),
    [mapRetry, setMapRetry] = useState(0),
    [view, setView] = useState("home"),
    [origin, setOrigin] = useState<R>(),
    [destination, setDestination] = useState<R>(),
    [originText, setOriginText] = useState(""),
    [destinationText, setDestinationText] = useState(""),
    [direction, setDirection] = useState<"outbound" | "return">("outbound"),
    [searchTime, setSearchTime] = useState("08:30"),
    [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]),
    [bookingRoute, setBookingRoute] = useState<R>(),
    [chatTrip, setChatTrip] = useState<number>(),
    [chatMessages, setChatMessages] = useState<R[]>([]),
    [chatParticipants, setChatParticipants] = useState<R[]>([]),
    [chatDraft, setChatDraft] = useState(""),
    [chatCanSend, setChatCanSend] = useState(true),
    [chatBusy, setChatBusy] = useState(false),
    [chatError, setChatError] = useState(""),
    [chatBlockBusy, setChatBlockBusy] = useState(false),
    [reportBooking, setReportBooking] = useState<R>(),
    [reportSubject, setReportSubject] = useState(""),
    [reportMessage, setReportMessage] = useState(""),
    [reportBusy, setReportBusy] = useState(false),
    [reportError, setReportError] = useState(""),
    [ratingBooking, setRatingBooking] = useState<R>(),
    [ratingValue, setRatingValue] = useState("5"),
    [ratingComment, setRatingComment] = useState(""),
    [ratingBusy, setRatingBusy] = useState(false),
    [ratingError, setRatingError] = useState(""),
    [ratingRows, setRatingRows] = useState<R[]>([]),
    [ratingViewTrip, setRatingViewTrip] = useState<number>(),
    [ratingsBusy, setRatingsBusy] = useState(false),
    [ratingsError, setRatingsError] = useState(""),
    [ratedTrips, setRatedTrips] = useState<string[]>([]),
    [trustedShares, setTrustedShares] = useState<Record<string, R>>({}),
    [operatorUsage, setOperatorUsage] = useState<R>(),
    [operatorReports, setOperatorReports] = useState<R[]>([]),
    [trustedShareBusy, setTrustedShareBusy] = useState<string | null>(null),
    [operatorError, setOperatorError] = useState(""),
    [operatorTicket, setOperatorTicket] = useState<R>(),
    [operatorTicketBusy, setOperatorTicketBusy] = useState(false);
  const profile = me?.profile || {};
  const profileForSave = {
    role,
    vehicle_preference: "both",
    schedule_mode: "fixed",
    home: { lat: 12.9716, lng: 77.5946, label: "Selected home" },
    campus: { lat: 12.9352, lng: 77.62, label: "Selected campus" },
    outbound_time: "08:30",
    return_time: "17:30",
    weekdays: [1, 2, 3, 4, 5],
    ...profile,
  };
  const mapRef = useRef<HTMLDivElement>(null);
  const intentKeys = useRef(new Map<string, string>());
  const chatSendKey = useRef<{ tripId: number; text: string; key: string } | undefined>(undefined);
  const chatBlockKey = useRef<{ tripId: number; target: number; blocked: boolean; key: string } | undefined>(undefined);
  const reportKey = useRef<{ identity: string; key: string } | undefined>(undefined);
  const ratingKey = useRef<{ identity: string; key: string } | undefined>(undefined);
  const operatorGeneration = useRef(0);
  const reportGeneration = useRef(0);
  const chatGeneration = useRef(0);
  const trustedShareGeneration = useRef(0);
  function clearSession() {
    setToken("");
    setMe(undefined);
    setRides([]);
    setScanTruncated(false);
    setWaitlist([]);
    setWaitlistQuotes({});
    setWaitlistTerms({});
    setBookings([]);
    setNotifications([]);
    setNotificationUnread(0);
    setNotificationsUnavailable(false);
    setOffers([]);
    setOffersBusy(false);
    setOffersUnavailable(false);
    setWallet(undefined);
    setOrigin(undefined);
    setDestination(undefined);
    setOriginText("");
    setDestinationText("");
    setRouteGeometry([]);
    setBookingRoute(undefined);
    setChatTrip(undefined);
    setChatMessages([]);
    setChatParticipants([]);
    setChatDraft("");
    setChatCanSend(true);
    setChatBusy(false);
    setChatError("");
    setChatBlockBusy(false);
    chatSendKey.current = undefined;
    chatBlockKey.current = undefined;
    setReportBooking(undefined);
    setReportSubject("");
    setReportMessage("");
    setReportError("");
    setReportBusy(false);
    reportKey.current = undefined;
    setRatingBooking(undefined);
    setRatingValue("5");
    setRatingComment("");
    setRatingError("");
    setRatingBusy(false);
    setRatingRows([]);
    setRatingViewTrip(undefined);
    setRatingsError("");
    setRatingsBusy(false);
    ratingKey.current = undefined;
    setRatedTrips([]);
    setTrustedShares({});
    setTrustedShareBusy(null);
    trustedShareGeneration.current += 1;
    setOperatorUsage(undefined);
    setOperatorReports([]);
    setOperatorError("");
    setOperatorTicket(undefined);
    setOperatorTicketBusy(false);
    operatorGeneration.current += 1;
    reportGeneration.current += 1;
    chatGeneration.current += 1;
    setView("home");
    setNotice("");
    intentKeys.current.clear();
  }
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("mobility:unauthorized", onUnauthorized);
    return () => window.removeEventListener("mobility:unauthorized", onUnauthorized);
  }, []);
  useEffect(() => {
    if (!token || !me?.operator || view !== "operator") return;
    let active = true;
    setOperatorError("");
    request("operator/dashboard", token)
      .then((dashboard) => {
        if (!active) return;
        setOperatorUsage(dashboard?.usage || {});
        setOperatorReports(Array.isArray(dashboard?.reports) ? dashboard.reports : []);
      })
      .catch((e: any) => {
        if (active && e?.status !== 401) setOperatorError(e?.message || "Operator dashboard is unavailable.");
      });
    return () => { active = false; };
  }, [token, me?.operator, view]);

  async function openOperatorTicket(id: number) {
    if (!me?.operator || !Number.isSafeInteger(id) || id < 1) return;
    const generation = operatorGeneration.current;
    const sessionToken = token;
    setOperatorTicketBusy(true); setOperatorError("");
    try {
      const result = await request(`admin/support/tickets/${id}`, sessionToken);
      if (generation !== operatorGeneration.current || sessionToken !== token || !me?.operator) return;
      setOperatorTicket(result?.data || result);
    } catch (e: any) { if (e?.status !== 401) setOperatorError(e?.message || "Report details are unavailable."); }
    finally { setOperatorTicketBusy(false); }
  }

  async function operatorTicketAction(id: number, action: "assign-me" | "resolve") {
    if (!me?.operator || !Number.isSafeInteger(id) || id < 1) return;
    const generation = operatorGeneration.current;
    const sessionToken = token;
    const key = crypto.randomUUID();
    setOperatorTicketBusy(true); setOperatorError("");
    try {
      await request(`admin/support/tickets/${id}/${action}`, sessionToken, "POST", {}, key);
      if (generation !== operatorGeneration.current || sessionToken !== token || !me?.operator) return;
      setNotice(action === "resolve" ? "Report resolved and audit recorded." : "Report assigned to you.");
      await openOperatorTicket(id);
      if (generation !== operatorGeneration.current || sessionToken !== token || !me?.operator) return;
      const dashboard = await request("operator/dashboard", sessionToken);
      if (generation !== operatorGeneration.current || sessionToken !== token || !me?.operator) return;
      setOperatorUsage(dashboard?.usage || {});
      setOperatorReports(Array.isArray(dashboard?.reports) ? dashboard.reports : []);
    } catch (e: any) { if (e?.status !== 401) setOperatorError(e?.message || "Report action failed."); }
    finally { setOperatorTicketBusy(false); }
  }
  useEffect(() => {
    if (!token) {
      setMapStatus("idle");
      setMapError("");
      return;
    }
    const fail = (message: string) => {
      setMapStatus("unavailable");
      setMapError(message);
    };
    const ready = () => {
      setMapStatus("ready");
      setMapError("");
    };
    setMapStatus("loading");
    return loadMapsSdk({
      fetchImpl: fetch,
      documentRef: document,
      google: (window as any).google,
      onReady: ready,
      onUnavailable: fail,
    });
  }, [token, mapRetry]);
  useEffect(() => {
    if (mapStatus !== "ready" || view !== "home") return;
    const listeners: { remove: () => void }[] = [];
    (["origin", "destination"] as const).forEach((k) => {
      const el = document.getElementById(
        `${k}-place`,
      ) as HTMLInputElement | null;
      if (!el) return;
      const g = (window as any).google;
      const a = new g.maps.places.Autocomplete(el, {
        fields: ["formatted_address", "geometry", "name"],
      });
      const listener = a.addListener("place_changed", () => {
        const p = a.getPlace();
        if (p.geometry?.location) {
          const v = {
            label: p.formatted_address || p.name,
            lat: p.geometry.location.lat(),
            lng: p.geometry.location.lng(),
          };
          if (k === "origin") {
            setBookingRoute(undefined);
            setRouteGeometry([]);
            setNotice("");
            setOrigin(v);
            setOriginText(v.label);
          } else {
            setBookingRoute(undefined);
            setRouteGeometry([]);
            setNotice("");
            setDestination(v);
            setDestinationText(v.label);
          }
        }
      });
      listeners.push(listener);
    });
    return () => listeners.forEach((listener) => listener.remove());
  }, [mapStatus, view]);
  useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const g = (window as any).google;
    const mapOrigin = bookingRoute?.origin || origin;
    const mapDestination = bookingRoute?.destination || destination;
    const center = {
      lat: Number(mapOrigin?.lat || profile.home?.lat || 12.9716),
      lng: Number(mapOrigin?.lng || profile.home?.lng || 77.5946),
    };
    const map = new g.maps.Map(mapRef.current, {
      center,
      zoom: 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    const points = [mapOrigin, mapDestination].filter(Boolean);
    points.forEach(
      (p: any, i) =>
        new g.maps.Marker({
          map,
          position: { lat: Number(p.lat), lng: Number(p.lng) },
          label: i ? "B" : "A",
          title: p.label,
        }),
    );
    if (routeGeometry.length > 1) {
      const path = routeGeometry.map(([lng, lat]) => ({ lat, lng }));
      new g.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: "#1458f4",
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
      const bounds = new g.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds);
    }
  }, [
    mapStatus,
    origin,
    destination,
    routeGeometry,
    bookingRoute,
    view,
    profile.home?.lat,
    profile.home?.lng,
  ]);
  async function sync(t: string, sessionRole = role) {
    const [meResult, bookingsResult, waitlistResult, walletResult, offersResult, notificationsResult] = await Promise.allSettled([
      request("commute/me", t),
      request("commute/bookings", t),
      sessionRole === "rider" ? request("commute/waitlist", t) : Promise.resolve({ data: [] }),
      request("commute/wallet", t),
      sessionRole === "driver" ? request("commute/offers", t) : Promise.resolve(undefined),
      request("commute/notifications", t),
    ]);
    if (meResult.status === "rejected") throw meResult.reason;
    const m = meResult.value;
    const b = bookingsResult.status === "fulfilled" ? bookingsResult.value : undefined;
    const wl = waitlistResult.status === "fulfilled" ? waitlistResult.value : undefined;
    const w = walletResult.status === "fulfilled" ? walletResult.value : undefined;
    const unavailable = [
      bookingsResult.status === "rejected" ? "bookings" : "",
      waitlistResult.status === "rejected" ? "waitlist" : "",
      walletResult.status === "rejected" ? "wallet" : "",
      sessionRole === "driver" && offersResult.status === "rejected" ? "published rides" : "",
    ].filter(Boolean);
    if (unavailable.length) {
      setError(`Could not load ${unavailable.join(" and ")} right now.`);
    }
    setMe(m);
    setDirection("outbound");
    setSearchTime(String(m.profile?.outbound_time || "08:30").slice(0, 5));
    if (m.profile?.home) {
      setOrigin(m.profile.home);
      setOriginText(m.profile.home.label || "");
    }
    if (m.profile?.campus) {
      setDestination(m.profile.campus);
      setDestinationText(m.profile.campus.label || "");
    }
    setBookingsUnavailable(bookingsResult.status === "rejected");
    setWalletUnavailable(walletResult.status === "rejected");
    setOffersUnavailable(sessionRole === "driver" && offersResult.status === "rejected");
    setNotificationsUnavailable(notificationsResult.status === "rejected");
    if (bookingsResult.status === "fulfilled") setBookings(list(b));
    if (waitlistResult.status === "fulfilled") { setWaitlist(list(wl)); setWaitlistQuotes({}); setWaitlistTerms({}); }
    if (walletResult.status === "fulfilled") setWallet(w);
    if (sessionRole === "driver" && offersResult.status === "fulfilled") setOffers(list(offersResult.value));
    if (notificationsResult.status === "fulfilled") { setNotifications(list(notificationsResult.value)); setNotificationUnread(Number(notificationsResult.value?.unread_count || 0)); }
  }
  async function refreshBookings() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const results = await Promise.allSettled([
        request("commute/bookings", token),
        role === "rider" ? request("commute/waitlist", token) : Promise.resolve({ data: [] }),
        role === "driver" ? request("commute/offers", token) : Promise.resolve(undefined),
        request("commute/notifications", token),
      ]);
      const bookingsResult = results[0];
      const waitlistResult = results[1];
      const offersResult = results[2];
      const notificationsResult = results[3];
      const failed = [
        bookingsResult.status === "rejected" ? "bookings" : "",
        waitlistResult.status === "rejected" ? "waitlist" : "",
        role === "driver" && offersResult.status === "rejected" ? "published rides" : "",
      ].filter(Boolean);
      if (bookingsResult.status === "fulfilled") {
        setBookings(list(bookingsResult.value));
        setBookingsUnavailable(false);
      } else {
        setBookingsUnavailable(true);
      }
      if (waitlistResult.status === "fulfilled") { setWaitlist(list(waitlistResult.value)); setWaitlistQuotes({}); setWaitlistTerms({}); }
      if (role === "driver" && offersResult.status === "fulfilled") {
        setOffers(list(offersResult.value));
        setOffersUnavailable(false);
      } else if (role === "driver") {
        setOffersUnavailable(true);
      }
      if (notificationsResult.status === "fulfilled") { setNotifications(list(notificationsResult.value)); setNotificationUnread(Number(notificationsResult.value?.unread_count || 0)); setNotificationsUnavailable(false); }
      else setNotificationsUnavailable(true);
      if (failed.length) {
        setError(`Could not load ${failed.join(" and ")} right now.`);
      } else {
        setNotice("Booking activity refreshed.");
      }
    } catch (e: any) {
      if (e?.status !== 401) setError(e?.message || "Could not refresh booking activity right now.");
    } finally {
      setBusy(false);
    }
  }
  async function markNotification(id: number) {
    try {
      await request(`commute/notifications/${id}/read`, token, "POST", {});
      setNotifications((rows) => rows.map((row) => row.id === id ? { ...row, read_at: new Date().toISOString() } : row));
      setNotificationUnread((count) => Math.max(0, count - 1));
    } catch (e: any) { if (e?.status !== 401) setError(e?.message || "Could not mark notification read."); }
  }
  async function openChat(tripId: number) {
    const generation = ++chatGeneration.current;
    if (chatTrip !== tripId) {
      setChatDraft("");
      chatSendKey.current = undefined;
    }
    setChatTrip(tripId);
    setChatMessages([]);
    setChatParticipants([]);
    setChatCanSend(false);
    setChatError("");
    setChatBlockBusy(false);
    chatBlockKey.current = undefined;
    setChatBusy(true);
    try {
      const d = await request(`trips/${tripId}/messages`, token);
      if (generation !== chatGeneration.current) return;
      const data = d?.data || d;
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      setChatParticipants(Array.isArray(data?.participants) ? data.participants : []);
      setChatMessages(messages);
      setChatCanSend(data?.can_send === true);
      const through = messages.at(-1)?.id;
      if (through) {
        try {
          await request(`trips/${tripId}/messages/read`, token, "POST", { through_id: through });
        } catch {
          // Read receipts are advisory; keep the chat usable if they fail.
        }
      }
    } catch (e: any) {
      if (generation !== chatGeneration.current) return;
      setChatCanSend(false);
      if (e?.status !== 401) setChatError(e?.message || "Could not load trip chat.");
    } finally {
      if (generation === chatGeneration.current) setChatBusy(false);
    }
  }
  async function sendChat() {
    const text = chatDraft.trim();
    if (!chatTrip || !text || chatBusy || !chatCanSend) return;
    const tripId = chatTrip;
    const generation = chatGeneration.current;
    setChatBusy(true);
    setChatError("");
    const key = chatSendKey.current?.tripId === tripId && chatSendKey.current.text === text
      ? chatSendKey.current.key
      : crypto.randomUUID();
    chatSendKey.current = { tripId, text, key };
    try {
      const d = await request(`trips/${tripId}/messages`, token, "POST", { text }, key);
      if (generation !== chatGeneration.current) return;
      const message = d?.data || d;
      if (message?.id) setChatMessages((current) => [...current, message]);
      setChatDraft("");
      chatSendKey.current = undefined;
    } catch (e: any) {
      if (generation !== chatGeneration.current) return;
      if (e?.status !== 401) setChatError(e?.message || "Could not send chat message.");
    } finally {
      if (generation === chatGeneration.current) setChatBusy(false);
    }
  }
  async function toggleChatBlock(participant: R) {
    const tripId = chatTrip;
    const target = Number(participant?.id);
    const actor = Number(me?.user?.id);
    if (!tripId || !Number.isInteger(target) || target <= 0 || target === actor || chatBlockBusy) return;
    const blocked = participant.blocked_by_you !== true;
    const generation = chatGeneration.current;
    setChatBlockBusy(true);
    setChatError("");
    const key = chatBlockKey.current?.tripId === tripId && chatBlockKey.current.target === target && chatBlockKey.current.blocked === blocked
      ? chatBlockKey.current.key
      : crypto.randomUUID();
    chatBlockKey.current = { tripId, target, blocked, key };
    try {
      await request(`trips/${tripId}/blocks`, token, "POST", { target_user_id: target, blocked }, key);
      if (generation !== chatGeneration.current) return;
      setChatParticipants((current) => current.map((item) => Number(item.id) === target ? { ...item, blocked_by_you: blocked } : item));
      if (blocked) setChatCanSend(false);
      chatBlockKey.current = undefined;
      setNotice(blocked ? "Participant blocked for future matching and chat. Existing accepted obligations remain unchanged." : "Participant unblocked. Refresh chat to re-check access.");
    } catch (e: any) {
      if (generation === chatGeneration.current && e?.status !== 401) setChatError(e?.message || "Could not update participant block.");
    } finally {
      if (generation === chatGeneration.current) setChatBlockBusy(false);
    }
  }
  async function login(next: string) {
    setBusy(true);
    setError("");
    try {
      const d = await request("commute/demo-session", "", "POST", {
        role: next,
        scenario: "campus-route",
      });
      setRole(next);
      await sync(d.token, next);
      setToken(d.token);
    } catch (e: any) {
      if (e?.status !== 401) setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(typeof body.message === "string" ? body.message : "Administrator sign-in failed.");
      const signedToken = body?.token || body?.data?.token;
      if (typeof signedToken !== "string" || !signedToken) throw Error("Administrator sign-in did not return a session token.");
      const identity = await request("commute/me", signedToken);
      if (identity?.operator !== true) throw Error("This account is not an administrator.");
      setRole("operator"); setMe(identity); setToken(signedToken); setView("operator");
      setAdminPassword("");
    } catch (e: any) {
      setError(e?.message || "Administrator sign-in failed.");
    } finally { setBusy(false); }
  }
  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBookingRoute(undefined);
    setRouteGeometry([]);
    setNotice("");
    if (!origin || !destination) {
      setError("Select both places from Google Places suggestions.");
      return;
    }
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const selectedDirection = String(f.get("direction") || direction) as
        | "outbound"
        | "return";
      const selectedTime = String(f.get("time") || searchTime);
      const numberOr = (value: FormDataEntryValue | null, fallback: number) => {
        const raw = String(value ?? "").trim();
        return raw === "" ? fallback : Number(raw);
      };
      const maxWalk = numberOr(f.get("max_walk_meters"), Number(profile.max_walk_meters ?? 500));
      const genderIdentity = String(f.get("gender_identity") || "");
      const sameGenderOnly = f.get("same_gender_only") === "on";
      const body =
        selectedDirection === "return"
          ? {
              ...profileForSave,
              max_walk_meters: maxWalk,
              gender_identity: genderIdentity || null,
              same_gender_only: sameGenderOnly,
              home: destination,
              campus: origin,
              return_time: selectedTime,
            }
          : {
              ...profileForSave,
              max_walk_meters: maxWalk,
              gender_identity: genderIdentity || null,
              same_gender_only: sameGenderOnly,
              home: origin,
              campus: destination,
              outbound_time: selectedTime,
            };
      const pointEqual = (a: R | undefined, b: R | undefined) =>
        Boolean(
          a &&
          b &&
          Number(a.lat) === Number(b.lat) &&
          Number(a.lng) === Number(b.lng),
        );
      const timeKey = selectedDirection === "return" ? "return_time" : "outbound_time";
      const savedTime = String(profile[timeKey] || "").slice(0, 5);
      const savedWalk = Number(profile.max_walk_meters ?? 500);
      const routeUnchanged =
        pointEqual(body.home, profile.home) &&
        pointEqual(body.campus, profile.campus) &&
        savedTime === selectedTime &&
        Number(body.max_walk_meters) === savedWalk;
      if (!routeUnchanged) {
        if (
          !window.confirm(
            "Save these selected locations and commute time to your profile before searching?",
          )
        )
          return;
        const saved = await request("commute/profile", token, "PUT", body);
        if (saved?.profile) setMe(saved);
      }
      if (role === "driver") {
        const publishBody = {
          date: f.get("date"),
          direction: selectedDirection,
          vehicle_type: f.get("vehicle") === "both" ? "car" : f.get("vehicle"),
          choice: f.get("driver_pickup_choice"),
          max_detour_meters: numberOr(f.get("max_detour_km"), 1) * 1000,
          max_detour_seconds: numberOr(f.get("max_detour_min"), 15) * 60,
          commute: body,
        };
        const intent = "commute/offers:" + JSON.stringify(publishBody);
        const key = intentKeys.current.get(intent) || crypto.randomUUID();
        intentKeys.current.set(intent, key);
        await request("commute/offers", token, "POST", publishBody, key);
        intentKeys.current.delete(intent);
        await sync(token);
        setNotice("Ride published. One rider seat is available for this trip.");
        setView("bookings");
        return;
      }
      const d = await request(
        `commute/rides?direction=${selectedDirection}&date=${f.get("date")}&vehicle_type=${f.get("vehicle")}&pickup_choice=${f.get("pickup_choice")}`,
        token,
      );
      setRides(list(d));
      setScanTruncated(d?.ranking?.candidate_scan_truncated === true);
      setBookingRoute(undefined);
      setRouteGeometry(list(d)[0]?.route_map?.driver_geometry || []);
      setView("rides");
    } catch (e: any) {
      if (e?.status !== 401) setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshOffers() {
    if (!token || role !== "driver" || offersBusy) return;
    setOffersBusy(true);
    setOffersUnavailable(false);
    try {
      const response = await request("commute/offers", token);
      setOffers(list(response));
    } catch {
      setOffersUnavailable(true);
    } finally {
      setOffersBusy(false);
    }
  }
  async function mutate(path: string, body: R = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    const intent = path + ":" + JSON.stringify(body);
    const key = intentKeys.current.get(intent) || crypto.randomUUID();
    intentKeys.current.set(intent, key);
    let saved = false;
    try {
      await request(path, token, "POST", body, key);
      saved = true;
      intentKeys.current.delete(intent);
      if (/^commute\/rides\/\d+\/request$/.test(path)) {
        setView("bookings");
        setNotice("Ride request sent. The driver can now accept or decline it.");
      } else {
        setNotice("Update saved.");
      }
    } catch (e: any) {
      // Retain the intent key: the server may have committed before the response was lost.
      // A retry with the same key replays the idempotent receipt response.
      if (e?.status !== 401) setError(e.message);
    } finally {
      setBusy(false);
    }
    if (saved) {
      try {
        await sync(token);
      } catch (e: any) {
        if (e?.status !== 401) setError("Saved, but the latest activity could not be refreshed. Try Refresh.");
      }
    }
  }
  function openReport(booking: R) {
    setReportBooking(booking);
    setReportSubject("");
    setReportMessage("");
    setReportError("");
    reportKey.current = { identity: `${Number(booking.trip_id)}\u0000`, key: crypto.randomUUID() };
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tripId = Number(reportBooking?.trip_id);
    const subject = reportSubject.trim();
    const message = reportMessage.trim();
    const generation = reportGeneration.current;
    if (!Number.isInteger(tripId) || tripId <= 0) {
      setReportError("This booking has no reportable trip.");
      return;
    }
    if (subject.length < 3 || message.length < 1) {
      setReportError("Add a subject and details before submitting.");
      return;
    }
    setReportBusy(true);
    setReportError("");
    const identity = `${tripId}\u0000${subject}\u0000${message}`;
    if (!reportKey.current || !reportKey.current.identity.startsWith(`${tripId}\u0000`) || reportKey.current.identity !== identity) {
      reportKey.current = { identity, key: crypto.randomUUID() };
    } else {
      reportKey.current.identity = identity;
    }
    try {
      await request(`trips/${tripId}/reports`, token, "POST", {
        subject,
        message_markdown: message,
      }, reportKey.current.key);
      if (generation !== reportGeneration.current) return;
      setNotice("Report submitted to support.");
      setReportBooking(undefined);
      setReportSubject("");
      setReportMessage("");
      reportKey.current = undefined;
    } catch (e: any) {
      if (generation !== reportGeneration.current) return;
      if (e?.status !== 401) setReportError(e?.message || "Could not submit report right now.");
    } finally {
      if (generation === reportGeneration.current) setReportBusy(false);
    }
  }
  function openRating(booking: R) {
    setRatingBooking(booking);
    setRatingValue("5");
    setRatingComment("");
    setRatingError("");
  }
  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tripId = Number(ratingBooking?.trip_id);
    const rateeId = Number(ratingBooking?.owner ? ratingBooking?.rider_id : ratingBooking?.driver_id);
    const rating = Number(ratingValue);
    if (!Number.isInteger(tripId) || tripId < 1 || !Number.isInteger(rateeId) || rateeId < 1) {
      setRatingError("This booking is missing a participant to rate.");
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setRatingError("Choose a rating from 1 to 5.");
      return;
    }
    setRatingBusy(true);
    setRatingError("");
    const generation = reportGeneration.current;
    const identity = `${tripId}\u0000${rateeId}\u0000${rating}\u0000${ratingComment.trim()}`;
    if (!ratingKey.current || ratingKey.current.identity !== identity) {
      ratingKey.current = { identity, key: crypto.randomUUID() };
    }
    try {
      await request(`trips/${tripId}/ratings`, token, "POST", {
        ratee_id: rateeId,
        rating,
        comment: ratingComment.trim() || null,
      }, ratingKey.current.key);
      if (generation !== reportGeneration.current) return;
      setNotice("Rating submitted. Ratings become visible to both participants after mutual submission.");
      setRatingBooking(undefined);
      ratingKey.current = undefined;
      const ratingKeyId = `${tripId}:${rateeId}`;
      setRatedTrips((current) => current.includes(ratingKeyId) ? current : [...current, ratingKeyId]);
      await refreshBookings();
      if (generation === reportGeneration.current) setNotice("Rating submitted. Ratings become visible to both participants after mutual submission.");
    } catch (e: any) {
      if (generation === reportGeneration.current && e?.status !== 401) setRatingError(e?.message || "Could not submit this rating right now.");
    } finally {
      if (generation === reportGeneration.current) setRatingBusy(false);
    }
  }
  async function viewRatings(booking: R) {
    const tripId = Number(booking.trip_id);
    if (!Number.isInteger(tripId) || tripId < 1) return;
    const generation = reportGeneration.current;
    setRatingsBusy(true);
    setRatingsError("");
    setRatingViewTrip(tripId);
    try {
      const result = await request(`trips/${tripId}/ratings`, token);
      if (generation !== reportGeneration.current) return;
      setRatingRows(list(result));
      const authored = list(result).filter((row: R) => row.direction === "authored" && Number(row.counterpart_id) > 0);
      if (authored.length) setRatedTrips((current) => Array.from(new Set([...current, ...authored.map((row: R) => `${tripId}:${Number(row.counterpart_id)}`)])));
    } catch (e: any) {
      if (generation === reportGeneration.current && e?.status !== 401) setRatingsError(e?.message || "Could not load ratings right now.");
    } finally {
      if (generation === reportGeneration.current) setRatingsBusy(false);
    }
  }
  const trustedShareId = (booking: R) => String(Number(booking.trip_id));
  const trustedShareExpired = (share?: R) => Boolean(share?.expires_at && Date.parse(String(share.expires_at)) <= Date.now());
  const trustedShareable = (booking: R) =>
    Boolean(booking.trip_id) && reportable(booking) &&
    (accepted(booking) || booking.state === "completed" || inProgress(booking) || boarded(booking) || alighted(booking));
  async function createTrustedShare(booking: R) {
    const tripId = Number(booking.trip_id);
    if (!Number.isInteger(tripId) || tripId < 1) return;
    const id = trustedShareId(booking);
    const generation = trustedShareGeneration.current;
    setTrustedShareBusy(id);
    setError("");
    try {
      const result = await request(`trips/${tripId}/trusted-shares`, token, "POST", {
        scope: "status",
        expires_in_minutes: 120,
      });
      const share = result?.data || result;
      if (!share?.token || !share?.grant_id) throw new Error("The trusted link was not created.");
      if (generation !== trustedShareGeneration.current) return;
      setTrustedShares((current) => ({ ...current, [id]: share }));
      setNotice("Trusted status link ready for you to copy. It was not sent automatically.");
    } catch (e: any) {
      if (generation === trustedShareGeneration.current && e?.status !== 401) setError(e?.message || "Could not create a trusted status link right now.");
    } finally {
      if (generation === trustedShareGeneration.current) setTrustedShareBusy(null);
    }
  }
  async function copyTrustedShare(booking: R) {
    const share = trustedShares[trustedShareId(booking)];
    if (!share?.token || trustedShareExpired(share) || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      if (share?.token && trustedShareExpired(share)) setNotice("This trusted status link has expired. Create a new link before copying.");
      setError("Copy is unavailable in this browser. Create the link again or use a supported browser.");
      return;
    }
    try {
      const candidate = process.env.NEXT_PUBLIC_TRUSTED_SHARE_ORIGIN || window.location.origin;
      let origin: string | null = null;
      try {
        const parsed = new URL(candidate);
        const loopback = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
        const secure = parsed.protocol === "https:";
        if ((secure || loopback) && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash) origin = parsed.origin;
      } catch { origin = null; }
      if (!origin) {
        setError("Trusted links require an HTTPS origin or a loopback HTTP origin for local demos.");
        return;
      }
      await navigator.clipboard.writeText(`${origin}/api/mobility/trusted-shares/${share.token}`);
      setNotice("Trusted status link copied. Anyone with the link can view this ride status until it expires.");
    } catch {
      setError("Could not copy the trusted link. Try again from a secure browser context.");
    }
  }
  async function revokeTrustedShare(booking: R) {
    const share = trustedShares[trustedShareId(booking)];
    const tripId = Number(booking.trip_id);
    if (!share?.grant_id || !Number.isInteger(tripId) || tripId < 1) return;
    const id = trustedShareId(booking);
    setTrustedShareBusy(id);
    setError("");
    try {
      await request(`trips/${tripId}/trusted-shares/${share.grant_id}`, token, "DELETE");
      setTrustedShares((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setNotice("Trusted status link revoked.");
    } catch (e: any) {
      if (e?.status !== 401) setError(e?.message || "Could not revoke the trusted status link right now.");
    } finally {
      setTrustedShareBusy(null);
    }
  }
  // Mirror TripReportService: lifecycle projection never grants report access;
  // only trip ownership or the participant request state does.
  const reportable = (b: R) => b.owner === true || [1, 3, 4].includes(Number(b.request_state));
  const requested = (b: R) =>
    b.request_state === 0 ||
    b.state === "requested" ||
    b.status === "requested";
  const accepted = (b: R) =>
    b.request_state === 1 || b.state === "accepted" || b.status === "accepted";
  const inProgress = (b: R) =>
    b.state === "in_progress" ||
    b.status === "in_progress" ||
    b.participant_state === "in_progress";
  const boarded = (b: R) =>
    b.state === "boarded" ||
    b.status === "boarded" ||
    b.participant_state === "boarded";
  const alighted = (b: R) =>
    b.state === "alighted" ||
    b.status === "alighted" ||
    b.participant_state === "alighted";
  const requestLabel = (b: R) =>
    (
      ({
        0: "Request pending",
        1: "Accepted",
        2: "Declined",
        3: "Cancelled",
      }) as Record<number, string>
    )[Number(b.request_state)] ||
    b.state ||
    "Unknown";
  const bookingStatus = (b: R) => {
    const wallet = b.wallet_state === "held"
      ? "demo credits held"
      : b.wallet_state === "released"
        ? "demo credits released"
        : b.wallet_state === "refunded"
          ? "demo credits refunded"
          : b.wallet_state === "unpaid"
            ? "demo payment pending"
            : null;
    if (b.state === "completed") {
      return `Trip completed${b.rider_arrived_at ? " · arrival confirmed" : ""}${wallet ? ` · ${wallet}` : ""}`;
    }
    if (b.state === "in_progress") return `Trip in progress${wallet ? ` · ${wallet}` : ""}`;
    return `${requestLabel(b)}${wallet ? ` · ${wallet}` : ""}`;
  };
  if (!token)
    return (
      <main className="landing">
        <div className="brand">
          <span className="logo">m</span>mobility
        </div>
        <section className="hero">
          <div>
            <p className="eyebrow">CAMPUS COMMUTE DEMO</p>
            <h1>
              Share the
              <br />
              <em>way home.</em>
            </h1>
            <p className="lede">
              Select a role to open a local demonstration session.
            </p>
            <div className="demo-buttons">
              <button onClick={() => login("rider")} disabled={busy}>
                Find a ride <small>Rider session</small>
              </button>
              <button onClick={() => login("driver")} disabled={busy}>
                Offer a ride <small>Driver session</small>
              </button>
            </div>
            <details className="admin-login">
              <summary>Administrator sign-in</summary>
              <p className="fine">Use an existing administrator account. This form does not create accounts or grant privileges.</p>
              <form onSubmit={loginAdmin} className="form-grid">
                <label>Email<input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} autoComplete="username" required /></label>
                <label>Password<input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="current-password" required /></label>
                <button className="secondary wide" type="submit" disabled={busy}>Sign in as administrator</button>
              </form>
            </details>
            {error && <p className="error">{error}</p>}
            <p className="fine">
              Local classroom demo · synthetic credits only
            </p>
          </div>
          <div className="hero-art">
            <div className="sun" />
            <div className="road" />
          </div>
        </section>
      </main>
    );
  const home = profile.home?.label || "",
    campus = profile.campus?.label || "";
  const displayedHome = direction === "return" ? destination : origin;
  const displayedCampus = direction === "return" ? origin : destination;
  const savedTime = String(
    profile[direction === "return" ? "return_time" : "outbound_time"] || "",
  ).slice(0, 5);
  const savedRouteChanged =
    !displayedHome ||
    !displayedCampus ||
    Number(displayedHome.lat) !== Number(profile.home?.lat) ||
    Number(displayedHome.lng) !== Number(profile.home?.lng) ||
    Number(displayedCampus.lat) !== Number(profile.campus?.lat) ||
    Number(displayedCampus.lng) !== Number(profile.campus?.lng) ||
    searchTime !== savedTime;
  return (
    <main className="shell">
      <header>
        <div className="brand">
          <span className="logo">m</span>mobility
        </div>
        <span className="pill">{role.toUpperCase()} SESSION</span>
        <button
          className="signout"
          onClick={clearSession}
        >
          Sign out
        </button>
      </header>
      <div className="layout">
        <aside>
          <p className="muted">COMMUTE</p>
          {[
            ["home", "Overview"],
            ["rides", "Find rides"],
            ["bookings", "Bookings"],
            ["notifications", `Notifications${notificationUnread ? ` · ${notificationUnread}` : ""}`],
            ["waitlist", "Waitlist"],
            ["wallet", "Wallet"],
            ["driver-onboarding", "Driver onboarding"],
            ...(me?.operator ? [["operator", "Operations"]] : []),
          ].map(([v, l]) => (
            <button
              key={v}
              className={`nav ${view === v ? "active" : ""}`}
              onClick={() => setView(v)}
            >
              {l}
            </button>
          ))}
        </aside>
        <section className="content">
          <p className="eyebrow">
            {savedRouteChanged ? "COMMUTE CHANGES WILL SAVE BEFORE SEARCH" : "SAVED COMMUTE"}
          </p>
          <h2>
            {view === "home"
              ? "Choose your route."
              : view === "rides"
                ? "Available rides."
                : view === "bookings"
                  ? "Booking activity."
                : view === "notifications"
                  ? "Booking notifications."
                : view === "waitlist"
                  ? "Waitlist requests."
                : view === "operator"
                  ? "Operations overview."
                : view === "driver-onboarding"
                  ? "Apply to drive."
                  : "Demo wallet."}
          </h2>
          {error && <p className="error banner" role="alert">{error}</p>}
          {notice && <p className="banner" role="status">{notice}</p>}
          {view === "home" && (
            <>
              <form className="search-card" onSubmit={search}>
                <div className="field">
                  <label>FROM</label>
                  <input
                    id="origin-place"
                    placeholder={home || "Search origin"}
                    value={originText}
                    onChange={(e) => {
                      setOriginText(e.currentTarget.value);
                      if (e.currentTarget.value !== origin?.label) {
                        setOrigin(undefined);
                        setBookingRoute(undefined);
                        setNotice("");
                        setRouteGeometry([]);
                      }
                    }}
                  />
                </div>
                <div className="field">
                  <label>TO</label>
                  <input
                    id="destination-place"
                    placeholder={campus || "Search destination"}
                    value={destinationText}
                    onChange={(e) => {
                      setDestinationText(e.currentTarget.value);
                      if (e.currentTarget.value !== destination?.label) {
                        setDestination(undefined);
                        setBookingRoute(undefined);
                        setNotice("");
                        setRouteGeometry([]);
                      }
                    }}
                  />
                </div>
                <div className="field compact">
                  <label>DATE</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={tomorrowInKolkata()}
                    required
                  />
                </div>
                <div className="field compact">
                  <label>VEHICLE</label>
                  <select name="vehicle" defaultValue="both">
                    <option value="both">Any</option>
                    <option value="car">Car</option>
                    <option value="bike">Bike</option>
                  </select>
                </div>
                <div className="field compact">
                  <label>DIRECTION</label>
                  <select
                    name="direction"
                    value={direction}
                    onChange={(e) => {
                      const next = e.currentTarget.value as
                        | "outbound"
                        | "return";
                      setBookingRoute(undefined);
                      setRouteGeometry([]);
                      setNotice("");
                      setDirection(next);
                      setOrigin(destination);
                      setDestination(origin);
                      setOriginText(destination?.label || "");
                      setDestinationText(origin?.label || "");
                      setSearchTime(
                        String(
                          next === "return"
                            ? profile.return_time
                            : profile.outbound_time,
                        ).slice(0, 5),
                      );
                    }}
                  >
                    <option value="outbound">To campus</option>
                    <option value="return">Back home</option>
                  </select>
                </div>
                <div className="field compact">
                  <label>TIME</label>
                  <input
                    name="time"
                    type="time"
                    value={searchTime}
                    onChange={(e) => setSearchTime(e.currentTarget.value)}
                    required
                  />
                </div>
                {role === "rider" ? (
                  <>
                    <div className="field compact">
                      <label>PICKUP</label>
                      <select name="pickup_choice" defaultValue="both">
                        <option value="both">Direct or meeting point</option>
                        <option value="DIRECT_RIDER_PICKUP">Direct pickup</option>
                        <option value="ON_ROUTE_MEETING_POINT">Meeting point</option>
                      </select>
                    </div>
                    <div className="field compact">
                      <label>MAX WALK (M)</label>
                      <input name="max_walk_meters" type="number" min="0" max="999" defaultValue={String(profile.max_walk_meters ?? 500)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field compact">
                      <label>DRIVER PICKUP</label>
                      <select name="driver_pickup_choice" defaultValue="DIRECT_RIDER_PICKUP">
                        <option value="DIRECT_RIDER_PICKUP">Direct rider pickup</option>
                        <option value="ON_ROUTE_MEETING_POINT">On-route meeting point</option>
                      </select>
                    </div>
                    <div className="field compact">
                      <label>MAX DETOUR (KM)</label>
                      <input name="max_detour_km" type="number" min="0" max="10" step="0.1" defaultValue="1" />
                    </div>
                    <div className="field compact">
                      <label>MAX DETOUR (MIN)</label>
                      <input name="max_detour_min" type="number" min="0" max="30" defaultValue="15" />
                    </div>
                  </>
                )}
                <div className="field compact">
                  <label>RIDER SAFETY PREFERENCE</label>
                  <select name="gender_identity" defaultValue="">
                    <option value="">Do not use gender matching</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="self_described">Self-described</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <label className="checkline"><input name="same_gender_only" type="checkbox" /> Match only with the same gender</label>
                  <small className="fine">Optional. Your identity is used only for matching and is never shown in ride cards.</small>
                </div>
                <button className="primary" disabled={busy}>
                  {role === "driver" ? "Publish ride" : "Search rides"}
                </button>
              </form>
              <div className="map-card">
                <div ref={mapRef} className="real-map">
                  <span>
                    {mapStatus === "ready"
                      ? "Google Maps + Places loaded"
                      : mapStatus === "unavailable"
                        ? `${mapError} Use Retry after checking configuration.`
                        : "Loading Google Maps configuration…"}
                  </span>
                  {mapStatus === "unavailable" && (
                    <button type="button" onClick={() => setMapRetry((value) => value + 1)}>
                      Retry map
                    </button>
                  )}
                </div>
                <div className="map-caption">
                  <b>
                    {bookingRoute?.origin?.label || origin?.label || home || "Origin"} →{" "}
                    {bookingRoute?.destination?.label || destination?.label || campus || "Destination"}
                  </b>
                  <span>
                    {bookingRoute
                      ? "Saved route from booking activity; current search locations were left unchanged."
                      : "Choose a suggestion to save exact coordinates for matching."}
                  </span>
                </div>
              </div>
            </>
          )}
          {view === "driver-onboarding" && <DriverOnboarding token={token} />}
          {view === "rides" && (
            <>
              {routeGeometry.length > 1 && (
                <div
                  ref={mapRef}
                  className="real-map"
                  aria-label="Matched ride route map"
                />
              )}
              <div className="cards">
                {rides.length === 0 ? (
                  <div className="empty">
                    No eligible rides returned for this route and date.{scanTruncated && " Only the first 50 candidate rides were considered; other matches may exist."}
                  </div>
                ) : (
                  <>
                  {scanTruncated && <p className="fine" role="note">Only the first 50 candidate rides were considered; other matches may exist.</p>}
                  <p className="fine" role="note">Matches are ranked by pickup-time fit, added detour, walking distance, demo fare, and available seats. Route overlap is not scored because the current quote does not provide that metric.</p>
                  {rides.map((r, i) => (
                    <article className="ride" key={r.trip_id || i}>
                      <div className="ride-time">
                        {r.rank && <small aria-label={`Match rank ${r.rank}`}>#{r.rank} match</small>}
                        <b>
                          {r.departure_at
                            ? new Date(r.departure_at).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" },
                              )
                            : "—"}
                        </b>
                        <span>{durationMinutes(r) == null ? "—" : `${durationMinutes(r)} min`}</span>
                      </div>
                      <div className="ride-route">
                        <b>{r.pickup_label || origin?.label}</b>
                        <span>↓</span>
                        <b>{r.dropoff_label || destination?.label}</b>
                        <small>
                          {r.driver_name || "Driver"} · {r.vehicle_label || r.vehicle_type || "—"}
                        </small>
                        {(r.seats_offered != null || r.seats_available != null) && (
                          <small aria-label="Seats offered">
                            Seats offered: {r.seats_offered ?? "—"} · {r.seats_available ?? "—"} available
                          </small>
                        )}
                        <small>
                          {r.choice === "ON_ROUTE_MEETING_POINT"
                            ? "Pickup: on-route meeting point"
                            : r.choice === "DIRECT_RIDER_PICKUP"
                              ? "Pickup: direct rider pickup"
                              : r.choice
                                ? `Pickup: ${r.choice}`
                                : null}
                        </small>
                        {(meters(r.access_meters) || meters(r.egress_meters) || meters(r.walking_meters)) && (
                          <small>
                            {meters(r.access_meters) && `Access walk ${meters(r.access_meters)}`}
                            {meters(r.egress_meters) && ` · Egress walk ${meters(r.egress_meters)}`}
                            {meters(r.walking_meters) && ` · Total walk ${meters(r.walking_meters)}`}
                          </small>
                        )}
                        {pickupWindow(r) && <small>Pickup window: {pickupWindow(r)}</small>}
                        {Array.isArray(r.ranking_reasons) && r.ranking_reasons.length > 0 && <small aria-label="Match ranking reasons">{r.ranking_reasons.join(" · ")}</small>}
                      </div>
                      <div className="ride-fare">
                        {typeof r.base_fare_minor === "number" && (
                          <small>Base demo fare {cash(r.base_fare_minor)}</small>
                        )}
                        {typeof r.surcharge_minor === "number" && (
                          <small>Pickup extra {cash(r.surcharge_minor)}</small>
                        )}
                        {typeof r.total_fare_minor === "number" && (
                          <b>Total demo fare {cash(r.total_fare_minor)}</b>
                        )}
                        <label className="consent">
                          <input type="checkbox" id={`c${i}`} /> I agree to the
                          selected pickup, access walk, egress walk, pickup time,
                          and demo fare.
                        </label>
                        {r.waitlist_available ? (
                          <>
                            <p className="fine" role="note">
                              This ride is full. Joining the waitlist does not reserve a seat and never auto-approves a ride; the driver must review any future opening.
                            </p>
                            <button
                              className="primary"
                              onClick={() => mutate(`commute/rides/${r.trip_id}/waitlist`, { quote_token: r.quote_token })}
                            >
                              Join waitlist
                            </button>
                          </>
                        ) : <button
                          className="primary"
                          onClick={() => {
                            const c = document.getElementById(
                              `c${i}`,
                            ) as HTMLInputElement;
                            if (!c.checked) {
                              setError("Agree to the fare before requesting this ride.");
                              return;
                            }
                            mutate(`commute/rides/${r.trip_id}/request`, {
                              quote_token: r.quote_token,
                            });
                          }}
                        >
                          Request
                        </button>}
                      </div>
                    </article>
                  ))}
                  </>
                )}
              </div>
            </>
          )}
          {view === "bookings" && (
            <>
              <div className="section-head">
                <span className="muted">Updates from the other session appear after refresh.</span>
                <button type="button" onClick={refreshBookings} disabled={busy}>
                  {busy ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {chatTrip && (
                <div className="wallet" aria-label={`Trip chat ${chatTrip}`}>
                  <div className="section-head">
                    <b>Trip chat · trip {chatTrip}</b>
                    <button type="button" onClick={() => openChat(chatTrip)} disabled={chatBusy || chatBlockBusy}>
                      {chatBusy ? "Loading…" : "Refresh chat"}
                    </button>
                  </div>
                  <p className="fine">Messages are visible only to accepted trip participants. In-app demo chat; no external delivery.</p>
                  {!chatCanSend && <p className="error banner">Chat is currently read-only; refresh to verify access.</p>}
                  {chatParticipants.some((participant) => Number(participant.id) !== Number(me?.user?.id)) && (
                    <div className="participant-safety" aria-label="Trip participant safety controls">
                      <b>Participant safety</b>
                      <p className="fine">Blocking prevents future matching and pauses new chat. It does not cancel rides, change accepted fares, seats, routes, lifecycle, or history.</p>
                      {chatParticipants.filter((participant) => Number(participant.id) !== Number(me?.user?.id)).map((participant) => (
                        <div className="actions" key={participant.id}>
                          <span>{participant.name || `Participant ${participant.id}`}</span>
                          <button type="button" onClick={() => toggleChatBlock(participant)} disabled={chatBlockBusy}>
                            {participant.blocked_by_you ? "Unblock" : "Block participant"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {chatError && <p className="error banner" role="alert">{chatError}</p>}
                  <div className="cards" aria-live="polite">
                    {chatMessages.length === 0 ? (
                      <div className="empty">No messages yet.</div>
                    ) : chatMessages.map((message, index) => (
                      <div className="booking" key={message.id || index}>
                        <span>{message.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="actions">
                    <input
                      aria-label="Trip chat message"
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.currentTarget.value)}
                      placeholder="Write a message"
                      maxLength={800}
                    />
                    <button type="button" onClick={sendChat} disabled={chatBusy || !chatCanSend || !chatDraft.trim()}>
                      Send
                    </button>
                  </div>
                </div>
              )}
              {reportBooking && (
                <form className="wallet" aria-label="Trip report form" onSubmit={submitReport}>
                  <div className="section-head">
                    <b>Report an issue · trip {reportBooking.trip_id}</b>
                    <button type="button" onClick={() => setReportBooking(undefined)} disabled={reportBusy}>Cancel</button>
                  </div>
                  <p className="fine">Reports are sent to in-app support. Only trip participants can submit them.</p>
                  {reportError && <p className="error banner" role="alert">{reportError}</p>}
                  <label>Subject
                    <input aria-label="Report subject" value={reportSubject} onChange={(event) => setReportSubject(event.currentTarget.value)} maxLength={160} required />
                  </label>
                  <label>Details
                    <textarea aria-label="Report details" value={reportMessage} onChange={(event) => setReportMessage(event.currentTarget.value)} maxLength={4000} required rows={4} />
                  </label>
                  <button className="primary" type="submit" disabled={reportBusy}>{reportBusy ? "Submitting…" : "Submit report"}</button>
                </form>
              )}
              {ratingBooking && (
                <form className="wallet" aria-label="Trip rating form" onSubmit={submitRating}>
                  <div className="section-head">
                    <b>Rate your completed trip · trip {ratingBooking.trip_id}</b>
                    <button type="button" onClick={() => setRatingBooking(undefined)} disabled={ratingBusy}>Cancel</button>
                  </div>
                  <p className="fine">Your rating is private until both participants submit. Please keep comments respectful.</p>
                  {ratingError && <p className="error banner" role="alert">{ratingError}</p>}
                  <label>Rating
                    <select aria-label="Trip rating" value={ratingValue} onChange={(event) => setRatingValue(event.currentTarget.value)}>
                      {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                    </select>
                  </label>
                  <label>Comment (optional)
                    <textarea aria-label="Rating comment" value={ratingComment} onChange={(event) => setRatingComment(event.currentTarget.value)} maxLength={1000} rows={3} />
                  </label>
                  <button className="primary" type="submit" disabled={ratingBusy}>{ratingBusy ? "Submitting…" : "Submit rating"}</button>
                </form>
              )}
              {ratingViewTrip && (
                <div className="wallet" aria-label={`Trip ratings ${ratingViewTrip}`}>
                  <div className="section-head">
                    <b>Ratings · trip {ratingViewTrip}</b>
                    <button type="button" onClick={() => setRatingViewTrip(undefined)}>Close</button>
                  </div>
                  <p className="fine">Only your submitted rating and mutually submitted counterpart ratings are shown.</p>
                  {ratingsError && <p className="error banner" role="alert">{ratingsError}</p>}
                  {ratingRows.length === 0 ? <div className="empty">No mutually visible ratings yet.</div> : (
                    <div className="cards">{ratingRows.map((row, index) => <div className="booking" key={row.id || index}><b>{row.direction === "authored" ? "Your rating" : "Received rating"} · {row.rating}/5</b>{row.comment && <span>{row.comment}</span>}</div>)}</div>
                  )}
                </div>
              )}
              {role === "driver" && (
                <section className="offer-management" aria-labelledby="published-rides-heading">
                  <div className="section-head">
                    <h3 id="published-rides-heading">Your published rides</h3>
                    <button type="button" disabled={offersBusy} onClick={refreshOffers}>
                      {offersBusy ? "Refreshing…" : "Refresh rides"}
                    </button>
                  </div>
                  <p className="fine">Each published ride offers one rider seat. A rider request must be accepted before the seat is reserved.</p>
                  {offersUnavailable && <p className="error banner" role="alert">Published rides could not be refreshed. Your current list is kept.</p>}
                  {offers.length === 0 && !offersUnavailable ? <div className="empty">No upcoming rides published. Use the route form to publish a commute.</div> : null}
                  {offers.length > 0 && (
                <div className="cards">
                  {offers.map((offer, i) => (
                    <article className="booking" key={offer.trip_id || i}>
                      <div>
                        <b>{offer.pickup_label} → {offer.dropoff_label}</b>
                        {instant(offer.departure_at) && <span>Departure · {instant(offer.departure_at)} IST</span>}
                        <span>Published · {offer.vehicle_type} · {pickupChoiceLabel(offer.choice)} · {Number(offer.seats_available) > 0 ? "1 rider seat available" : "No rider seats available"}</span>
                        {offer.max_detour_meters != null && <span>Detour limit · {(Number(offer.max_detour_meters) / 1000).toFixed(1)} km · {Math.round(Number(offer.max_detour_seconds || 0) / 60)} min</span>}
                      </div>
                    </article>
                  ))}
                </div>
                  )}
                </section>
              )}
              {bookingsUnavailable && (
                <p className="error banner">Bookings are temporarily unavailable; existing data is preserved.</p>
              )}
            <div className="cards">
              {bookings.length === 0 && !bookingsUnavailable ? (
                <div className="empty">
                  No bookings recorded for this session.
                </div>
              ) : bookings.length > 0 ? (
                bookings.map((b, i) => (
                  <article className="booking" key={b.booking_id || i}>
                    <div>
                      <b>
                        {b.pickup_label || "Pickup"} →{" "}
                        {b.dropoff_label || "Dropoff"}
                      </b>
                      {instant(b.departure_at) && <span>Departure · {instant(b.departure_at)} IST</span>}
                      <span>
                        {bookingStatus(b)} ·{" "}
                        {cash(b.total_fare_minor || b.fare_minor)}
                      </span>
                    </div>
                    <div className="actions">
                      {requested(b) && role === "driver" && (
                        <>
                          <button
                            onClick={() =>
                              mutate(`commute/bookings/${b.booking_id}/accept`)
                            }
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              mutate(`commute/bookings/${b.booking_id}/reject`)
                            }
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {accepted(b) &&
                        role === "rider" &&
                        b.wallet_state === "unpaid" &&
                        b.state === "planned" && (
                          <button
                            onClick={() =>
                              mutate(`commute/bookings/${b.booking_id}/pay`)
                            }
                          >
                            Confirm payment
                          </button>
                        )}
                      {accepted(b) && b.trip_id && (
                        <button type="button" onClick={() => openChat(Number(b.trip_id))} disabled={chatBusy || chatBlockBusy}>
                          Trip chat
                        </button>
                      )}
                      {trustedShareable(b) && (!trustedShares[trustedShareId(b)] || trustedShareExpired(trustedShares[trustedShareId(b)])) && (
                        <button type="button" onClick={() => createTrustedShare(b)} disabled={trustedShareBusy === trustedShareId(b)}>
                          {trustedShareBusy === trustedShareId(b) ? "Creating link…" : "Create trusted status link"}
                        </button>
                      )}
                      {trustedShareable(b) && trustedShares[trustedShareId(b)] && !trustedShareExpired(trustedShares[trustedShareId(b)]) && (
                        <div className="trusted-share" role="group" aria-label="Trusted status link">
                          <span className="fine">Expires {instant(trustedShares[trustedShareId(b)].expires_at) || "soon"}. Anyone with the link can view status; treat this bearer link like a password because URLs may be recorded by infrastructure. Local demo links work only on this device.</span>
                          <button type="button" onClick={() => copyTrustedShare(b)} disabled={trustedShareBusy === trustedShareId(b)}>Copy link</button>
                          <button type="button" onClick={() => revokeTrustedShare(b)} disabled={trustedShareBusy === trustedShareId(b)}>Revoke link</button>
                        </div>
                      )}
                      {b.trip_id && reportable(b) && (
                        <button type="button" onClick={() => openReport(b)} disabled={reportBusy}>
                          Report issue
                        </button>
                      )}
                      {b.trip_id && b.state === "completed" && reportable(b) && !ratedTrips.includes(`${Number(b.trip_id)}:${Number(b.owner ? b.rider_id : b.driver_id)}`) && (
                        <button type="button" onClick={() => openRating(b)} disabled={ratingBusy}>
                          Rate trip
                        </button>
                      )}
                      {b.trip_id && b.state === "completed" && reportable(b) && (
                        <button type="button" onClick={() => viewRatings(b)} disabled={ratingsBusy}>
                          {ratingsBusy ? "Loading ratings…" : "View ratings"}
                        </button>
                      )}
                      {b.trip_id && role === "driver" && driverAction(b) && (
                        <button
                          onClick={() =>
                            mutate(`commute/trips/${b.trip_id}/transition`, {
                              action: driverAction(b),
                              ...(driverAction(b) === "board" ||
                              driverAction(b) === "alight"
                                ? { passenger_id: b.rider_id }
                                : {}),
                            })
                          }
                        >
                          {driverAction(b) === "start"
                            ? "Start trip"
                            : driverAction(b) === "board"
                              ? "Board rider"
                              : driverAction(b) === "alight"
                                ? "Alight rider"
                                : "Complete trip"}
                        </button>
                      )}
                      {accepted(b) &&
                        role === "rider" &&
                        b.state === "completed" &&
                        !b.rider_arrived_at && (
                          <button
                            onClick={() =>
                              mutate(
                                `commute/bookings/${b.booking_id}/confirm-arrival`,
                              )
                            }
                          >
                            Confirm arrival
                          </button>
                        )}
                      {b.owner && b.wallet_state === "held" && b.release_at && (
                        <button
                          onClick={() => mutate("commute/wallet/release-due")}
                        >
                          Check release
                        </button>
                      )}
                      {b.owner && b.wallet_state === "released" && !b.receipt && (
                        <button
                          onClick={() =>
                            mutate(`commute/bookings/${b.booking_id}/confirm-payment-received`)
                          }
                        >
                          Confirm payment received (demo)
                        </button>
                      )}
                      {b.receipt && (
                        <span className="fine" role="status">
                          Demo receipt {b.receipt.receipt_number} · non-redeemable synthetic credit
                        </span>
                      )}
                      {Array.isArray(b.route_map?.driver_geometry) &&
                        b.route_map.driver_geometry.length > 1 && (
                          <button
                            onClick={() => {
                              const geometry = b.route_map.driver_geometry as [number, number][];
                              const first = geometry[0];
                              const last = geometry[geometry.length - 1];
                              setBookingRoute({
                                origin: {
                                  lat: first[1],
                                  lng: first[0],
                                  label:
                                    b.driver_route_origin_label ||
                                    "Driver route origin",
                                },
                                destination: {
                                  lat: last[1],
                                  lng: last[0],
                                  label:
                                    b.driver_route_destination_label ||
                                    "Driver route destination",
                                },
                              });
                              setRouteGeometry(geometry);
                              setView("home");
                              setNotice("Showing the saved driver route for this booking.");
                            }}
                          >
                            View route
                          </button>
                        )}
                      {(requested(b) || accepted(b)) &&
                        b.state === "planned" && (
                          <button
                            onClick={() =>
                              mutate(`commute/bookings/${b.booking_id}/cancel`)
                            }
                          >
                            Cancel
                          </button>
                        )}
                    </div>
                  </article>
                ))
              ) : null}
            </div>
            </>
          )}
          {view === "notifications" && (
            <div className="wallet" aria-label="Booking notifications">
              <div className="section-head">
                <span className="muted">Private in-app updates for your bookings only.</span>
                <button type="button" onClick={refreshBookings} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
              </div>
              {notificationsUnavailable && <p className="error banner">Booking notifications are temporarily unavailable.</p>}
              {!notificationsUnavailable && notifications.length === 0 ? <div className="empty">No booking notifications yet.</div> : (
                <div className="cards" aria-live="polite">
                  {notifications.map((n, i) => <article className="booking" key={n.id || i}>
                    <div><b>{n.title}</b><span>{n.body}</span><span className="fine">Booking {n.booking_id} · {instant(n.created_at) || "Just now"}</span></div>
                    {!n.read_at && <button type="button" onClick={() => markNotification(Number(n.id))}>Mark read</button>}
                  </article>)}
                </div>
              )}
            </div>
          )}
          {view === "waitlist" && (
            <>
              <p className="fine">Waitlisting records interest in a full ride. It does not reserve a seat, charge credits, or automatically approve a booking. Any future opening still requires driver review.</p>
              <div className="cards">
                {waitlist.length === 0 ? <div className="empty">You have no active waitlist requests.</div> : waitlist.map((entry, i) => (
                  <article className="booking" key={entry.id || i}>
                    <div>
                      <b>Trip {entry.trip_id}</b>
                    <span>{entry.status === "requested" ? "You requested a seat and are waiting for driver review. Cancel this seat request here if your plans change." : entry.actionable ? "A seat is available for your turn (availability snapshot); refresh eligibility and terms before requesting driver review." : "Pending driver-reviewed waitlist request"}</span>
                    </div>
                    <div className="actions">
                      {entry.status === "pending" && !waitlistQuotes[entry.id] && <button type="button" onClick={async () => { try { const d = await request(`commute/waitlist/${entry.id}/refresh`, token, "POST", {}); setWaitlistQuotes((q) => ({ ...q, [entry.id]: d?.data?.quote_token })); setWaitlistTerms((q) => ({ ...q, [entry.id]: d?.data?.terms })); setNotice("Fresh route and fare loaded. Review and confirm before requesting driver review."); } catch (e: any) { setError(e.message); } }}>Refresh eligibility and terms</button>}
                      {entry.actionable && waitlistQuotes[entry.id] && <><span>Route {waitlistTerms[entry.id]?.pickup_label} → {waitlistTerms[entry.id]?.dropoff_label}</span><span>Walk {waitlistTerms[entry.id]?.access_meters || 0} m access · {waitlistTerms[entry.id]?.egress_meters || 0} m egress</span><span>Fresh fare {cash(waitlistTerms[entry.id]?.fare_minor)} · pickup {instant(waitlistTerms[entry.id]?.pickup_at) || "—"}</span><label className="fine"><input type="checkbox" id={`waitlist-consent-${entry.id}`} /> I agree to the refreshed route, pickup time, walking distances, and demo fare.</label><button type="button" onClick={() => { const c = document.getElementById(`waitlist-consent-${entry.id}`) as HTMLInputElement; if (!c.checked) { setError("Agree to the refreshed route and fare before requesting driver review."); return; } mutate(`commute/waitlist/${entry.id}/request`, { quote_token: waitlistQuotes[entry.id], consent: true }); }}>Request seat for driver review</button></>}
                      <button type="button" onClick={() => mutate(`commute/waitlist/${entry.id}/cancel`)}>{entry.status === "requested" ? "Cancel seat request" : "Cancel waitlist"}</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {view === "wallet" && (
            <div className="wallet">
              <p className="eyebrow">DEMO CREDIT BALANCE</p>
              {walletUnavailable && <p className="error">Wallet is temporarily unavailable; showing the last known balance.</p>}
              <h3>{cash(wallet?.available_minor || wallet?.balance_minor)}</h3>
              <p>
                Synthetic credits only. No external payment provider is
                connected.
              </p>
              <button
                className="primary"
                onClick={() =>
                  mutate("commute/wallet/top-up", { amount_minor: 50000 })
                }
              >
                Add demo credits
              </button>
            </div>
          )}
          {view === "operator" && me?.operator && (
            <div className="cards">
              <p className="fine">Read-only operator view. Counts are limited to the synthetic classroom demo and report subjects; ticket messages and internal notes are never exposed here.</p>
              {operatorError && <p className="error" role="alert">{operatorError}</p>}
              <div className="cards">
                {[
                  ["Demo actors", operatorUsage?.demo_actors],
                  ["Demo trips", operatorUsage?.demo_trips],
                  ["Bookings", operatorUsage?.bookings],
                  ["Pending waitlist", operatorUsage?.waitlist_pending],
                  ["Open reports", operatorUsage?.reports_open],
                  ["Ratings submitted", operatorUsage?.ratings_submitted],
                ].map(([label, value]) => <article className="booking" key={String(label)}><b>{label}</b><span>{value ?? "—"}</span></article>)}
              </div>
              <h3>Report queue</h3>
              {operatorReports.length === 0 ? <div className="empty">No reports are queued for the demo trips.</div> : operatorReports.map((report) => (
                <article className="booking" key={report.id}>
                  <div><b>{report.subject}</b><span>Trip {report.trip_id} · {report.status} · {report.priority}</span></div>
                  <div className="actions">
                    {report.unread_for_admin && <span className="pill">UNREAD</span>}
                    <button type="button" onClick={() => openOperatorTicket(Number(report.id))} disabled={operatorTicketBusy}>Open report</button>
                    <button type="button" onClick={() => operatorTicketAction(Number(report.id), "assign-me")} disabled={operatorTicketBusy}>Assign to me</button>
                    {!(["Closed", "Resolved", "Cerrado", "Resuelto"].includes(String(report.status))) && <button type="button" onClick={() => operatorTicketAction(Number(report.id), "resolve")} disabled={operatorTicketBusy}>Resolve</button>}
                  </div>
                </article>
              ))}
              {operatorTicket && <article className="booking" aria-live="polite"><div><b>{operatorTicket.subject || "Report details"}</b><span>Status: {operatorTicket.status || "—"} · Trip {operatorTicket.trip_id || "—"}</span><span>{operatorTicket.message_markdown || operatorTicket.message || "No report body is exposed in the summary."}</span></div><button type="button" onClick={() => setOperatorTicket(undefined)}>Close details</button></article>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
