"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import styles from "./PesTimetable.module.css";

type Entry = { day: number; dayName: string; slot: number; option: number; start: string; end: string; title: string };
const knownElectives = new Set(["UE24AM342AA1", "UE24AM342AA4", "UE24AM342AA5"]);
const unresolvedTitle = "Overlapping classes (not identified)";
const code = (entry: Entry) => entry.title.match(/^([A-Z0-9]+)(?:\s*[-–:]|$)/i)?.[1]?.toUpperCase();

// Academy may return several choices at the same time. Only the three verified
// elective codes can be collapsed as electives; other overlaps remain unresolved.
export function summarizeSlots(entries: Entry[]): Entry[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = `${e.day}:${e.slot}`;
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return [...groups.values()].map(group => {
    const elective = group.every(e => { const value = code(e); return value && knownElectives.has(value); });
    return elective ? { ...group[0], option: 1, title: "Elective" }
      : group.length === 1 ? group[0] : { ...group[0], option: 1, title: unresolvedTitle };
  }).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}
const subject = (title: string) => title.replace(/^[A-Z0-9]+\s*[-–:]\s*/i, "");
const prettyTime = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
};

export default function PesTimetable({ token }: { token: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    let active = true; const version = ++generation.current;
    fetch("/api/mobility/commute/pes-timetable", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(r => { if (!r.ok) throw Error("Could not load saved timetable."); return r.json(); })
      .then(j => { if (active && version === generation.current && Array.isArray(j?.data) && j.data.length) { setEntries(summarizeSlots(j.data)); setMessage("Showing your saved timetable."); } })
      .catch(() => { if (active && version === generation.current) setError("Could not load saved timetable."); });
    return () => { active = false; };
  }, [token]);

  async function load(event: FormEvent) {
    event.preventDefault(); if (busy) return; ++generation.current; setBusy(true); setError("");
    try {
      const res = await fetch("/api/pes-timetable", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username, password }), cache: "no-store" });
      const json = await res.json(); if (!res.ok) throw Error(json.error || "Import failed.");
      if (!Array.isArray(json.data?.entries) || !json.data.entries.length) throw Error("No classes found.");
      setEntries(summarizeSlots(json.data.entries)); setMessage("Timetable imported. Review it, then save it.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Import failed."); }
    finally { setPassword(""); setBusy(false); }
  }
  async function save() {
    if (!entries.length) return;
    if (entries.some(e => e.title === unresolvedTitle)) { setError("Unidentified overlapping classes need review in Academy before saving."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/mobility/commute/pes-timetable", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ entries }), cache: "no-store" });
      if (!response.ok) throw Error("Could not save timetable."); setMessage("Timetable saved to your account.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not save timetable."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/mobility/commute/pes-timetable", { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw Error("Could not delete saved timetable."); setEntries([]); setMessage("Saved timetable deleted.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not delete timetable."); }
    finally { setBusy(false); }
  }
  const periods = useMemo(() => [...new Map(entries.map(e => [`${e.start}:${e.end}`, { start: e.start, end: e.end }])).values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)), [entries]);
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const lastDay = Math.max(6, ...entries.map(e => e.day));
  return <section className={styles.panel} aria-label="PES Academy timetable">
    <div className={styles.header}><div><span className={styles.kicker}>YOUR WEEK AT A GLANCE</span><h3>Class timetable</h3><p>Import from PES Academy and review your weekly schedule.</p></div><span className={styles.source}>PES ACADEMY</span></div>
    <form onSubmit={load} className={styles.importForm}>
      <label>SRN<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter your SRN" /></label>
      <label>PES password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" /></label>
      <button disabled={busy}>{busy ? "Please wait…" : entries.length ? "Import again" : "Import timetable"}</button>
    </form>
    <p className={styles.note}>Your PES password is used for this import and cleared from the form afterwards.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.status} role="status">{message}</p>}
    {entries.length > 0 ? <>
      <div className={styles.tableHeading}><div><span className={styles.kicker}>WEEKLY SCHEDULE</span><h4>Your classes</h4></div><span>Times in IST</span></div>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Weekly timetable, scroll horizontally if needed">
        <table className={styles.table}><caption className={styles.srOnly}>Weekly timetable</caption><thead><tr><th scope="col">Day</th>{periods.map(p => <th scope="col" key={`${p.start}-${p.end}`}>{prettyTime(p.start)}<span>to {prettyTime(p.end)}</span></th>)}</tr></thead>
          <tbody>{dayNames.slice(0, lastDay).map((name, index) => <tr key={name}><th scope="row">{name}</th>{periods.map(p => { const cell = entries.filter(e => e.day === index + 1 && e.start === p.start && e.end === p.end); return <td key={`${p.start}-${p.end}`}>{cell.length ? cell.map(e => <div className={`${styles.classCard} ${e.title === "Elective" ? styles.elective : ""} ${e.title === unresolvedTitle ? styles.unresolved : ""}`} key={`${e.day}:${e.slot}:${e.option}`}>{subject(e.title)}</div>) : <span className={styles.empty}>—</span>}</td>; })}</tr>)}</tbody>
        </table>
      </div>
      <div className={styles.legend}><span><i className={styles.dot} /> Class</span><span><i className={`${styles.dot} ${styles.electiveDot}`} /> Elective</span><span>— No entry returned by Academy</span></div>
      <p className={styles.note}>Known elective options are shown as “Elective”. Other overlapping classes are flagged. Review the schedule against Academy before using it.</p>
      <div className={styles.actions}><button disabled={busy} onClick={save}>Save timetable</button><button className={styles.secondary} disabled={busy} onClick={remove}>Delete saved timetable</button></div>
    </> : <div className={styles.emptyState}><strong>Your week will appear here</strong><p>Import your schedule to see classes arranged by day and time.</p></div>}
  </section>;
}
