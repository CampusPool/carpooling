"use client";

import { useEffect, useRef, useState } from "react";
import { emitUnauthorized } from "../lib/session-events";
import styles from "./RideRating.module.css";

type Rating = { direction: string; counterpart_id: number; rating: number };

export default function RideRating({ token, tripId, counterpartId, counterpartName }: {
  token: string; tripId: number; counterpartId: number; counterpartName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<number>();
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const attempt = useRef<{ body: string; key: string } | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/mobility/trips/${tripId}/ratings`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    }).then(async response => {
      if (response.status === 401) emitUnauthorized(token);
      if (!response.ok) throw new Error("Could not load your rating.");
      const body = await response.json();
      if (!Array.isArray(body?.data)) throw new Error("Could not load your rating.");
      const mine = body.data.find((row: Rating) => row.direction === "authored" && Number(row.counterpart_id) === counterpartId);
      if (!controller.signal.aborted) setSaved(mine?.rating);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Could not load your rating.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [token, tripId, counterpartId, reload]);

  async function submit() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    const body = JSON.stringify({ ratee_id: counterpartId, rating: selected, comment: comment.trim() || null });
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/mobility/trips/${tripId}/ratings`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body,
        cache: "no-store",
      });
      if (response.status === 401) emitUnauthorized(token);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error?.code === "TRIP_RATING_ALREADY_EXISTS") {
          setReload(value => value + 1);
          return;
        }
        throw new Error("Could not save your rating. Please try again.");
      }
      const data = await response.json();
      setSaved(Number(data.data.rating));
      setComment("");
    } catch {
      setError("Could not save your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.rating} aria-label={`Rate ${counterpartName}`}>
    {loading ? <p role="status">Loading your rating…</p> : error && !selected
      ? <p role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>Try again</button></p>
      : saved !== undefined ? <p role="status">Thanks for rating {counterpartName}! <span aria-label={`${saved} out of 5 stars`}>{"★".repeat(saved)}{"☆".repeat(5 - saved)}</span></p>
      : <>
        <p><strong>How was your ride?</strong> Rate {counterpartName} after your trip.</p>
        <div className={styles.stars} role="group" aria-label="Choose a rating">
          {[1, 2, 3, 4, 5].map(value => <button type="button" key={value} aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            aria-pressed={selected === value} disabled={busy} onClick={() => setSelected(value)}>{value <= selected ? "★" : "☆"}</button>)}
        </div>
        <label>Optional note
          <input value={comment} maxLength={200} disabled={busy} onChange={event => setComment(event.target.value)} placeholder="A little note about your ride" />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className={styles.submit} type="button" disabled={!selected || busy} onClick={() => void submit()}>{busy ? "Saving…" : "Send rating"}</button>
      </>}
  </section>;
}
