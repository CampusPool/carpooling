"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/commute-api";
import styles from "./PesTimetable.module.css";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const endpoint = "pes-timetable";

type ClassDetails = { day: number; title: string; start: string; end: string };
type ClassEntry = ClassDetails & { id: string };
type ImportedClass = ClassDetails & { slot: number; option: number };
const initialClass: ClassDetails = { day: 1, title: "", start: "", end: "" };

export default function PesTimetable({ token }: { token: string }) {
  const generation = useRef(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [imported, setImported] = useState<ImportedClass[]>([]);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<ClassEntry[]>([]);
  const [draft, setDraft] = useState<ClassDetails>(initialClass);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [verifyInAcademy, setVerifyInAcademy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTimetable = useCallback(async () => {
    const version = generation.current;
    setBusy(true);
    setLoadFailed(false);
    try {
      const result = await api(endpoint, token);
      if (version !== generation.current) return null;
      if (!Array.isArray(result.data)) throw Error("Invalid timetable response");
      const classes: ClassEntry[] = result.data.map((entry: ClassDetails) => ({ ...entry, id: crypto.randomUUID() }));
      setEntries(classes);
      setLoaded(true);
      return classes;
    } catch {
      if (version === generation.current) setLoadFailed(true);
      return null;
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    ++generation.current;
    setImported([]); setChoices({}); setPassword(""); setUsername("");
    setLoaded(false);
    setError("");
    setNotice("");
    setVerifyInAcademy(false);
    setEntries([]);
    setDraft(initialClass);
    setEditing(null);
    void loadTimetable();
    return () => { ++generation.current; };
  }, [loadTimetable]);

  async function importTimetable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const version = generation.current;
    setBusy(true); setError(""); setNotice(""); setVerifyInAcademy(false);
    const body = JSON.stringify({ username, password }); setPassword("");
    try {
      const response = await fetch("/api/pes-timetable", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body, cache: "no-store" });
      const result = await response.json();
      if (version !== generation.current) return;
      if (!response.ok) {
        setVerifyInAcademy(result.code === "PES_VERIFICATION_REQUIRED");
        throw Error(result.error || "Could not import your timetable.");
      }
      const data = result.data?.entries;
      if (!Array.isArray(data) || !data.length || data.length > 300) throw Error("No usable timetable was returned.");
      setImported(data); setChoices({});
      setNotice("Review the imported classes and any overlapping options before saving. Your saved timetable has not changed.");
    } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : "Could not import your timetable."); }
    finally { if (version === generation.current) setBusy(false); }
  }

  const groups = new Map<string, ImportedClass[]>();
  for (const entry of imported) {
    const key = `${entry.day}:${entry.slot}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  const unresolved = [...groups].some(([key, group]) => group.length > 1 && choices[key] === undefined);
  const selectedImport = [...groups].flatMap(([key, group]) => group.length === 1 ? group : group.filter(entry => entry.option === choices[key]));

  async function save(next: ClassEntry[], message: string): Promise<boolean> {
    if (busy) return false;
    if (next.length > 300 || dayNames.some((_, index) => next.filter(entry => entry.day === index + 1).length > 100)) {
      setError("Your timetable can contain up to 300 classes and 100 classes on one day.");
      return false;
    }
    const version = generation.current;
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
      if (version !== generation.current) return false;
      setEntries(next);
      setNotice(message);
      return true;
    } catch {
      if (version === generation.current) setError("Could not save your timetable. Try again.");
      return false;
    } finally {
      if (version === generation.current) setBusy(false);
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
    const currentEntries = loaded ? entries : await loadTimetable();
    if (!currentEntries) return;
    const entry = { ...draft, id: editing ?? crypto.randomUUID(), title };
    const next = editing ? currentEntries.map(current => current.id === editing ? entry : current) : [...currentEntries, entry];
    if (await save(next, editing ? "Class updated." : "Class added.")) stopEditing();
  }

  return <section className={styles.panel} aria-label="Weekly class timetable" aria-busy={busy}>
    <header className={styles.summary}>
      <h2>Your week</h2>
      <span>{loaded ? `${entries.length} ${entries.length === 1 ? "class" : "classes"} · IST` : "IST"}</span>
    </header>
    {loadFailed && <div className={styles.recovery} role="alert">
      <p>Could not load your timetable. You can enter a class below. Saving will retry loading your existing schedule first.</p>
      <button type="button" className="secondary" disabled={busy} onClick={() => void loadTimetable()}>Retry timetable</button>
    </div>}
    {entries.length > 0 && <WeeklyGrid entries={entries} label="Saved weekly timetable" />}
    <div className={styles.days}>
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
    </div>
    <details className={styles.importPanel}>
      <summary>Import from PES Academy</summary>
      <section aria-label="Import from PES Academy">
        <p>Use your Academy SRN and password to fetch your classes. Your password is used for this request and is not saved by CampusPool.</p>
      <form className={styles.form} onSubmit={importTimetable}>
        <label>Academy SRN<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} maxLength={128} required /></label>
        <label>Academy password<input type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} maxLength={256} required /></label>
        <div className={styles.actions}><button type="submit" className="primary" disabled={busy}>{busy ? "Please wait…" : "Import from PES Academy"}</button></div>
      </form>
      {verifyInAcademy && <a className={styles.academyLink} href="https://www.pesuacademy.com/Academy/" target="_blank" rel="noreferrer">Open PES Academy</a>}
      <p className={styles.note}>Review your classes before saving them to CampusPool.</p>
      </section>
    </details>
    {imported.length > 0 && <section className={styles.importPanel} aria-label="Review imported timetable">
      <h3>Review imported classes</h3>
      {[...groups].filter(([, group]) => group.length > 1).map(([key, group]) => <label className={styles.option} key={key}>
        {dayNames[group[0].day - 1]} {group[0].start}–{group[0].end}: choose your class
        <select value={choices[key] ?? ""} onChange={event => setChoices(current => ({ ...current, [key]: Number(event.target.value) }))}>
          <option value="" disabled>Select the class you attend</option>
          {group.map(entry => <option key={entry.option} value={entry.option}>{entry.title}</option>)}
        </select>
      </label>)}
      {unresolved && <p className={styles.note}>Academy returned overlapping options. Select your class for each slot before saving.</p>}
      <WeeklyGrid entries={selectedImport} label="Imported weekly timetable" mobile />
      {!loaded && <p className={styles.note}>Load your saved timetable before replacing it with this import.</p>}
      <div className={styles.actions}><button type="button" className="primary" disabled={busy || unresolved || !loaded} onClick={async () => {
        if (await save(selectedImport.map(entry => ({ ...entry, id: crypto.randomUUID() })), "Imported timetable saved.")) { setImported([]); setChoices({}); stopEditing(); }
      }}>{entries.length ? "Replace saved timetable" : "Save imported timetable"}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => { setImported([]); setChoices({}); setNotice(""); }}>Discard import</button></div>
    </section>}
    <form className={styles.form} onSubmit={submit}>
      <h3>{editing ? "Edit class" : "Add a class"}</h3>
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
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.status}>{notice}</p>}
    {!loaded && busy && <p role="status">Loading timetable…</p>}
    {loaded && !entries.length && <p className={styles.empty}>No classes yet.</p>}

  </section>;
}

function WeeklyGrid({ entries, label, mobile = false }: { entries: ClassDetails[]; label: string; mobile?: boolean }) {
  const periods = [...new Set(entries.map(entry => `${entry.start}–${entry.end}`))].sort();
  if (!periods.length) return null;
  return <>
  {mobile && <div className={styles.mobilePreview} aria-label={label}>
    {[...entries].sort((first, second) => first.day - second.day || first.start.localeCompare(second.start)).map((entry, index) =>
      <div key={index}><strong>{entry.title}</strong><span>{dayNames[entry.day - 1]} · {entry.start}–{entry.end}</span></div>)}
  </div>}
  <div className={styles.gridScroll} role="region" aria-label={label} tabIndex={0}>
    <table className={styles.week}><caption>{label} · IST</caption>
      <thead><tr><th scope="col">Time</th>{dayNames.map(day => <th scope="col" key={day}>{day.slice(0, 3)}</th>)}</tr></thead>
      <tbody>{periods.map(period => <tr key={period}><th scope="row">{period}</th>{dayNames.map((day, index) => <td key={day}>{entries.filter(entry => entry.day === index + 1 && `${entry.start}–${entry.end}` === period).map((entry, number) => <span className={styles.classCell} key={number}>{entry.title}</span>)}</td>)}</tr>)}</tbody>
    </table>
  </div></>;
}
