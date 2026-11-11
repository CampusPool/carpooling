"use client";

import { useEffect, useState, type FormEvent } from "react";
import AddressPlacePicker, { type AddressPlace } from "./AddressPlacePicker";
import { request } from "../lib/legacy-api";
import { loadMapsSdk } from "../lib/maps-loader.mjs";
import styles from "./PlannedRides.module.css";

export type RidePlan = {
  home: AddressPlace;
  campus: AddressPlace;
  outbound_time: string;
  return_time: string;
  weekdays: number[];
  paused: boolean;
  outbound_enabled: boolean;
  return_enabled: boolean;
};

type Draft = Omit<RidePlan, "home" | "campus"> & { home?: AddressPlace; campus?: AddressPlace };

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const initialPlan: Draft = {
  outbound_time: "07:30",
  return_time: "16:30",
  weekdays: [1, 2, 3, 4, 5],
  paused: false,
  outbound_enabled: true,
  return_enabled: true,
};

const endpoint = "address-rides/plan";

export default function PlannedRides({ token, onBack, onSaved }: {
  token: string;
  onBack: () => void;
  onSaved?: (plan: RidePlan) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initialPlan);
  const [saved, setSaved] = useState<RidePlan | null>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [mapsAttempt, setMapsAttempt] = useState(0);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setSaved(undefined);
    setLoadError("");
    request(endpoint, token).then(({ data }) => {
      if (!active) return;
      setSaved(data);
      setDraft(data ?? initialPlan);
    }).catch(() => {
      if (active) setLoadError("Could not load your schedule. Try again to recover your saved plan.");
    });
    return () => { active = false; };
  }, [token, loadAttempt]);

  useEffect(() => {
    setMapsReady(false);
    setMapsError("");
    return loadMapsSdk({
      fetchImpl: fetch,
      documentRef: document,
      google: (window as any).google,
      onReady: () => setMapsReady(true),
      onUnavailable: () => setMapsError("Address search is temporarily unavailable."),
    });
  }, [mapsAttempt]);

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setNotice("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || saved === undefined) return;
    if (!draft.home || !draft.campus) {
      setError("Select home and campus addresses from the suggestions.");
      return;
    }
    if (draft.home.lat === draft.campus.lat && draft.home.lng === draft.campus.lng) {
      setError("Choose a campus address different from home.");
      return;
    }
    if (!draft.weekdays.length || (!draft.paused && !draft.outbound_enabled && !draft.return_enabled)) {
      setError(!draft.weekdays.length ? "Select at least one travel day." : "Enable a direction or pause the schedule.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await request(endpoint, token, "PUT", draft);
      setDraft(data);
      setSaved(data);
      setNotice(data.paused ? "Schedule saved and paused." : "Schedule saved.");
      onSaved?.(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save your schedule. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? initialPlan);

  return <section className={styles.panel} aria-label="Planned rides">
    <div className={styles.heading}>
      <button type="button" className={styles.back} onClick={onBack}>← Back</button>
      <h1>Planned rides</h1>
      <p>Save your regular campus commute. You can use this schedule to start a ride search or create an offer.</p>
    </div>
    {loadError && <div className={styles.alert} role="alert">{loadError} <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>Retry</button></div>}
    {saved === undefined && !loadError && <p role="status">Loading your schedule…</p>}
    {saved !== undefined && <form className={styles.form} onSubmit={save} aria-busy={saving}>
      <div className={styles.fields}>
        <AddressPlacePicker label="Home location" value={draft.home} ready={mapsReady} disabled={saving} onChange={place => update("home", place)} />
        <AddressPlacePicker label="Campus location" value={draft.campus} ready={mapsReady} disabled={saving} onChange={place => update("campus", place)} />
      </div>
      {mapsError && <div className={styles.alert} role="alert">{mapsError} <button type="button" onClick={() => setMapsAttempt(value => value + 1)}>Retry address search</button></div>}
      <div className={styles.fields}>
        <div className={styles.direction}>
          <label className={styles.time}>Home to campus <input type="time" value={draft.outbound_time} onChange={event => update("outbound_time", event.target.value)} required disabled={saving} /></label>
          <label className={styles.toggle}><input type="checkbox" checked={draft.outbound_enabled} onChange={event => update("outbound_enabled", event.target.checked)} disabled={saving} /> Include departure</label>
        </div>
        <div className={styles.direction}>
          <label className={styles.time}>Campus to home <input type="time" value={draft.return_time} onChange={event => update("return_time", event.target.value)} required disabled={saving} /></label>
          <label className={styles.toggle}><input type="checkbox" checked={draft.return_enabled} onChange={event => update("return_enabled", event.target.checked)} disabled={saving} /> Include return</label>
        </div>
      </div>
      <fieldset className={styles.days}>
        <legend>Travel days</legend>
        <div>{days.map((day, index) => {
          const value = index + 1;
          const selected = draft.weekdays.includes(value);
          return <button key={day} type="button" aria-label={day} aria-pressed={selected} disabled={saving} onClick={() =>
            update("weekdays", selected ? draft.weekdays.filter(item => item !== value) : [...draft.weekdays, value].sort((a, b) => a - b))
          }>{day.slice(0, 3)}</button>;
        })}</div>
      </fieldset>
      <label className={styles.pause}><input type="checkbox" checked={draft.paused} disabled={saving} onChange={event => update("paused", event.target.checked)} /> Pause this schedule</label>
      <p className={styles.hint}>Times are in IST. Saving a schedule does not publish or cancel any rides.</p>
      {error && <p className={styles.alert} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <button className={styles.primary} type="submit" disabled={saving || !dirty}>{saving ? "Saving…" : "Save schedule"}</button>
    </form>}
  </section>;
}
