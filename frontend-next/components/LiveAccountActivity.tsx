"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Json } from "../lib/commute-api";
import styles from "./LiveAccountActivity.module.css";

type Props = {
  token: string;
  role: "rider" | "driver";
  notifications: Json[];
  unreadCount: number;
  onRefresh: () => Promise<void>;
};
type Quote = { quote_token: string; terms: Json };
const rows = (payload: any): Json[] => Array.isArray(payload?.data) ? payload.data : [];
const money = (minor: any) => `₹${(Number(minor || 0) / 100).toFixed(2)}`;
const when = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—";

/** Supplementary account actions, not a second ride search / booking flow. */
export default function LiveAccountActivity({ token, role, notifications, unreadCount, onRefresh }: Props) {
  const [wallet, setWallet] = useState<Json>();
  const [waitlist, setWaitlist] = useState<Json[]>([]);
  const [walletError, setWalletError] = useState("");
  const [waitlistError, setWaitlistError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [quotes, setQuotes] = useState<Record<number, Quote>>({});
  const [consents, setConsents] = useState<Record<number, boolean>>({});
  const mounted = useRef(true);
  const keys = useRef(new Map<string, string>());
  // A slower earlier poll must never overwrite a newer wallet/waitlist snapshot.
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([
      api("wallet", token),
      role === "rider" ? api("waitlist", token) : Promise.resolve({ data: [] }),
    ]);
    if (!mounted.current || sequence !== refreshSequence.current) return;
    if (results[0].status === "fulfilled") { setWallet(results[0].value); setWalletError(""); }
    else setWalletError("Wallet is temporarily unavailable. Showing last known values.");
    if (results[1].status === "fulfilled") { setWaitlist(rows(results[1].value)); setWaitlistError(""); }
    else setWaitlistError("Waitlist is temporarily unavailable. Retry when connected.");
  }, [token, role]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => { mounted.current = false; ++refreshSequence.current; clearInterval(timer); };
  }, [refresh]);

  async function perform(path: string, body: Json, message: string, after?: (value: Json) => void) {
    if (busy) return;
    setBusy(true); setActionError(""); setNotice("");
    const signature = `${path}:${JSON.stringify(body)}`;
    const key = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await api(path, token, "POST", body, key);
      keys.current.delete(signature);
      after?.(result);
      await Promise.all([refresh(), onRefresh()]);
      if (mounted.current) setNotice(message);
    } catch (error: any) {
      // A rejected quote is no longer safe to consent to. Reset its preview
      // and force another server-side eligibility/route/fare calculation.
      const staleWaitlistQuote = /^waitlist\/\d+\/request$/.test(path)
        && ["COMMUTE_QUOTE_CHANGED", "WAITLIST_NOT_ACTIONABLE", "WAITLIST_NOT_YOUR_TURN", "NOT_SEAT_AVAILABLE"].includes(error?.code);
      if (staleWaitlistQuote) {
        const id = Number(path.split("/")[1]);
        setQuotes(current => { const copy = { ...current }; delete copy[id]; return copy; });
        setConsents(current => ({ ...current, [id]: false }));
        keys.current.delete(signature);
        setActionError("Seat terms or eligibility changed. Refresh the waitlist, review the new route and fare, and consent again.");
        await refresh();
      } else {
        // Retry ambiguous network failures with the original idempotency key.
        setActionError(error?.message || "The action failed. Please retry.");
      }
    } finally { setBusy(false); }
  }

  async function refreshQuote(entry: Json) {
    if (busy) return;
    setBusy(true); setActionError(""); setNotice("");
    try {
      const response = await api(`waitlist/${entry.id}/refresh`, token, "POST", {}, crypto.randomUUID());
      const data = response?.data;
      if (!data?.quote_token || !data?.terms) throw Error("No valid seat terms were returned. Please retry.");
      setQuotes(current => ({ ...current, [Number(entry.id)]: { quote_token: data.quote_token, terms: data.terms } }));
      setConsents(current => ({ ...current, [Number(entry.id)]: false }));
      setNotice("Review the refreshed route and demo fare before requesting a seat.");
      await refresh();
    } catch (error: any) {
      setQuotes(current => { const copy = { ...current }; delete copy[Number(entry.id)]; return copy; });
      setActionError(error?.message || "No seat is available for your turn. Retry later.");
      await refresh();
    } finally { setBusy(false); }
  }

  return <section className={styles.activity} aria-label="Account activity">
    <header className={styles.heading}><h3>Your account activity</h3><button type="button" disabled={busy} onClick={() => void Promise.all([refresh(), onRefresh()])}>Refresh account</button></header>
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.grid}>
      <details className={styles.panel}>
        <summary>Demo wallet · {wallet ? money(wallet.available_minor) : "Loading…"}</summary>
        {walletError && <p className={styles.error} role="alert">{walletError}</p>}
        <p>Synthetic classroom credits, not real money or an external payment service.</p>
        <p>Available: <strong>{wallet ? money(wallet.available_minor) : "—"}</strong></p>
        <p>Held for rides: {wallet ? money(wallet.held_minor) : "—"} · Awaiting release: {wallet ? money(wallet.pending_release_minor) : "—"}</p>
        <button type="button" disabled={busy || !wallet} onClick={() => void perform("wallet/top-up", { amount_minor: 50000 }, "Added 500 demo credits to your wallet.")}>Add 500 demo credits</button>
        {!!wallet?.entries?.length && <ul>{wallet.entries.slice(0, 8).map((item: Json) => <li key={item.id}>{String(item.kind || item.type || "Activity")} · {money(item.amount_minor)} · {when(item.created_at)}</li>)}</ul>}
      </details>
      <details className={styles.panel}>
        <summary>Notifications{unreadCount ? ` · ${unreadCount} unread` : ""}</summary>
        <p>Private ride updates for this account.</p>
        {notifications.length === 0 && <p>No notifications yet.</p>}
        {notifications.map(n => <article className={styles.item} key={n.id}>
          <strong>{n.title || "Ride update"}</strong><p>{n.body}</p>
          <small>{when(n.created_at)}</small>
          {!n.read_at && <button type="button" disabled={busy} onClick={() => void perform(`notifications/${n.id}/read`, {}, "Notification marked as read.")}>Mark read</button>}
        </article>)}
      </details>
      {role === "rider" && <details className={styles.panel}>
        <summary>Seat waitlist{waitlist.length ? ` · ${waitlist.length} active` : ""}</summary>
        <p>Joining a full ride does not reserve a seat or charge credits. An available seat still requires driver approval.</p>
        {waitlistError && <p role="alert" className={styles.error}>{waitlistError}</p>}
        {!waitlist.length && <p>No active waitlist requests.</p>}
        {waitlist.map(entry => {
          const quote = quotes[Number(entry.id)];
          const terms = quote?.terms;
          return <article className={styles.item} key={entry.id}>
            <strong>Ride #{entry.trip_id}</strong><p>{entry.status === "requested" ? "Seat requested; waiting for driver review." : entry.actionable ? "Your turn may have arrived; refresh the terms." : "Waiting for a seat to become available."}</p>
            {entry.status === "pending" && !quote && <button type="button" disabled={busy} onClick={() => void refreshQuote(entry)}>Refresh eligibility and terms</button>}
            {entry.status === "pending" && quote && <div className={styles.terms}>
              <p>{terms?.pickup_label} → {terms?.dropoff_label}</p>
              <p>Access walk {terms?.access_meters ?? "—"} m · Egress walk {terms?.egress_meters ?? "—"} m</p>
              <p>Fare {money(terms?.fare_minor)} · Pickup {when(terms?.pickup_at)}</p>
              <label><input type="checkbox" checked={Boolean(consents[Number(entry.id)])} onChange={e => setConsents(current => ({ ...current, [Number(entry.id)]: e.target.checked }))} /> I agree to the refreshed pickup, walking distances, time and demo fare.</label>
              <button type="button" disabled={busy || !consents[Number(entry.id)]} onClick={() => void perform(`waitlist/${entry.id}/request`, { quote_token: quote.quote_token, consent: true }, "Seat requested for driver review.", () => setQuotes(current => { const copy = { ...current }; delete copy[Number(entry.id)]; return copy; }))}>Request seat for driver review</button>
            </div>}
            <button type="button" disabled={busy} onClick={() => void perform(`waitlist/${entry.id}/cancel`, {}, "Waitlist request cancelled.", () => setQuotes(current => { const copy = { ...current }; delete copy[Number(entry.id)]; return copy; }))}>{entry.status === "requested" ? "Cancel seat request" : "Cancel waitlist"}</button>
          </article>;
        })}
      </details>}
    </div>
  </section>;
}
