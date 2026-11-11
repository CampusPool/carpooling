"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/commute-api";
import styles from "./PesTimetable.module.css";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const endpoint = "pes-timetable";

type ClassDetails = { day: number; title: string; start: string; end: string };
type ClassEntry = ClassDetails & { id: string };
const initialClass: ClassDetails = { day: 1, title: "", start: "", end: "" };

export default function PesTimetable({ token }: { token: string }) {
  const [entries, setEntries] = useState<ClassEntry[]>([]);
  const [draft, setDraft] = useState<ClassDetails>(initialClass);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setBusy(true);
    setLoaded(false);
    setError("");
    setNotice("");
    setEntries([]);
    setDraft(initialClass);
    setEditing(null);
    api(endpoint, token)
      .then(result => {
        if (!active) return;
        if (!Array.isArray(result.data)) throw Error("Invalid timetable response");
        setEntries(result.data.map((entry: ClassDetails) => ({ ...entry, id: crypto.randomUUID() })));
        setLoaded(true);
      })
      .catch(() => { if (active) setError("Could not load your timetable. Reopen this page to try again."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token]);

  async function save(next: ClassEntry[], message: string): Promise<boolean> {
    if (busy || !loaded) return false;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const slotsByDay = new Map<number, number>();
      const data = next.map(({ day, title, start, end }) => {
        const slot = (slotsByDay.get(day) ?? 0) + 1;
        slotsByDay.set(day, slot);
        return { day, dayName: dayNames[day - 1], slot, option: 1, title, start, end };
      });
      if (data.length) await api(endpoint, token, "PUT", { entries: data });
      else await api(endpoint, token, "DELETE");
      setEntries(next);
      setNotice(message);
      return true;
    } catch {
      setError("Could not save your timetable. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function stopEditing() {
    setDraft(initialClass);
    setEditing(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    setNotice("");
    if (!title || draft.start >= draft.end) {
      setError("Enter a class name and an end time after the start time.");
      return;
    }
    const entry = { ...draft, id: editing ?? crypto.randomUUID(), title };
    const next = editing ? entries.map(current => current.id === editing ? entry : current) : [...entries, entry];
    if (next.length > 300 || next.filter(current => current.day === entry.day).length > 100) {
      setError("Your timetable can contain up to 300 classes and 100 classes on one day.");
      return;
    }
    if (await save(next, editing ? "Class updated." : "Class added.")) stopEditing();
  }

  return <section className={styles.panel} aria-label="Weekly class timetable" aria-busy={busy}>
    <p className={styles.description}>Add your classes to build a weekly schedule. Times are in IST.</p>
    {loaded && <form className={styles.form} onSubmit={submit}>
      <label>Class name<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={300} required /></label>
      <label>Day<select value={draft.day} onChange={event => setDraft({ ...draft, day: Number(event.target.value) })}>
        {dayNames.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
      </select></label>
      <label>Start time<input type="time" value={draft.start} onChange={event => setDraft({ ...draft, start: event.target.value })} required /></label>
      <label>End time<input type="time" value={draft.end} onChange={event => setDraft({ ...draft, end: event.target.value })} required /></label>
      <div className={styles.actions}>
        <button type="submit" className="primary" disabled={busy}>{editing ? "Save changes" : "Add class"}</button>
        {editing && <button type="button" className="secondary" onClick={stopEditing} disabled={busy}>Cancel</button>}
      </div>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.status}>{notice}</p>}
    {!loaded && busy && <p role="status">Loading timetable…</p>}
    {loaded && !entries.length && <p className={styles.empty}>No classes yet.</p>}
    {dayNames.map((day, index) => {
      const classes = entries.filter(entry => entry.day === index + 1).sort((first, second) => first.start.localeCompare(second.start));
      if (!classes.length) return null;
      return <section className={styles.day} key={day} aria-label={day}>
        <h3>{day}</h3>
        <ul>{classes.map(entry => <li key={entry.id}>
          <div><strong>{entry.title}</strong><span>{entry.start}–{entry.end}</span></div>
          <div className={styles.actions}>
            <button type="button" className="secondary" aria-label={`Edit ${entry.title}`} disabled={busy} onClick={() => {
              setDraft(entry);
              setEditing(entry.id);
              setNotice("");
              setError("");
            }}>Edit</button>
            <button type="button" className="secondary" aria-label={`Remove ${entry.title}`} disabled={busy} onClick={async () => {
              if (await save(entries.filter(current => current.id !== entry.id), "Class removed.") && editing === entry.id) stopEditing();
            }}>Remove</button>
          </div>
        </li>)}</ul>
      </section>;
    })}
  </section>;
}
