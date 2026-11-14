"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./RideSafety.module.css";

export default function RideSafety({ token, tripId }: { token: string; tripId: number }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef<{ action: string; key: string } | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/mobility/trusted-contact", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && typeof data?.email === "string") setEmail(data.email); })
      .catch(() => {});
    return () => controller.abort();
  }, [token]);

  async function save(safe: boolean, event?: FormEvent) {
    event?.preventDefault();
    if (busy || (!safe && (!email.trim() || !consent))) return;
    setBusy(true); setError(""); setMessage("");
    const action = safe ? "safe" : `unsafe:${email.trim().toLowerCase()}`;
    if (attempt.current?.action !== action) attempt.current = { action, key: crypto.randomUUID() };
    try {
      if (!safe) {
        const contact = await fetch("/api/mobility/trusted-contact", {
          method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), consent_confirmed: true }), cache: "no-store",
        });
        if (!contact.ok) throw new Error("Check the contact email and try again.");
      }
      const response = await fetch(`/api/mobility/trips/${tripId}/safety-check`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: JSON.stringify({ safe }), cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body?.error?.code === "SAFETY_DELIVERY_UNCONFIRMED") throw new Error("We couldn't confirm email delivery. Please contact them directly before trying again.");
        throw new Error("The safety check could not be saved. Please try again.");
      }
      setMessage(safe ? "Thanks for checking in." : "Your alert was accepted by the email provider. Please contact them directly if you need immediate help.");
      setHelp(false); setConsent(false); attempt.current = undefined;
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <section className={styles.safety} aria-label="Ride safety check">
    <strong>Are you safe?</strong>
    <p>Check in during or after your ride.</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {!help && <div className={styles.actions}>
      <button type="button" disabled={busy} onClick={() => void save(true)}>I'm safe</button>
      <button type="button" disabled={busy} onClick={() => { setHelp(true); setError(""); setMessage(""); }}>I don't feel safe</button>
    </div>}
    {help && <form onSubmit={event => void save(false, event)}>
      <p>We’ll email your trusted contact your name, account email and profile phone number. Live location is not shared. This does not contact emergency services.</p>
      <label>Trusted contact email<input type="email" value={email} onChange={event => { setEmail(event.target.value); attempt.current = undefined; }} maxLength={254} required disabled={busy} /></label>
      <label className={styles.check}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required disabled={busy} /> I have their permission to contact them.</label>
      <div className={styles.actions}><button type="submit" disabled={busy || !consent || !email.trim()}>{busy ? "Sending…" : "Notify trusted contact"}</button>
        <button type="button" disabled={busy} onClick={() => setHelp(false)}>Cancel</button></div>
    </form>}
  </section>;
}
