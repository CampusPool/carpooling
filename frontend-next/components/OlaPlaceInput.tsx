"use client";

import { useEffect, useRef, useState } from "react";
import { olaAutocomplete, olaDetails, type OlaPlace, type OlaSuggestion } from "../lib/ola-client";
import styles from "./LiveCarpool.module.css";

type Props = { label: string; token: string; ready: boolean; value?: OlaPlace; disabled?: boolean; onChange: (value?: OlaPlace) => void };

export default function OlaPlaceInput({ label, token, ready, value, disabled, onChange }: Props) {
  const [query, setQuery] = useState(value?.label || "");
  const [suggestions, setSuggestions] = useState<OlaSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => { setQuery(value?.label || ""); }, [value?.label]);
  useEffect(() => {
    if (!ready || disabled || value || query.trim().length < 3) { setSuggestions([]); return; }
    const serial = ++generation.current;
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const result = await olaAutocomplete(query.trim(), token);
        if (serial === generation.current) setSuggestions(result.predictions || []);
      } catch (cause) {
        if (serial === generation.current) { setSuggestions([]); setError(cause instanceof Error ? cause.message : "Ola place suggestions unavailable."); }
      } finally { if (serial === generation.current) setBusy(false); }
    }, 350);
    return () => { clearTimeout(timer); generation.current++; };
  }, [ready, disabled, value, query, token]);
  async function choose(suggestion: OlaSuggestion) {
    const serial = ++generation.current;
    setBusy(true); setError(""); setSuggestions([]);
    try {
      const { place } = await olaDetails(suggestion.placeId, token);
      if (serial !== generation.current) return;
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) || place.lat < 12.65 || place.lat > 13.35 || place.lng < 77.2 || place.lng > 77.95) {
        setError("Choose a Bengaluru place in the supported campus area."); return;
      }
      const selected = { ...place, label: place.label.slice(0, 160) };
      onChange(selected); setQuery(selected.label);
    } catch (cause) {
      if (serial === generation.current) setError(cause instanceof Error ? cause.message : "Ola could not resolve this place.");
    } finally { if (serial === generation.current) setBusy(false); }
  }
  return <div className={styles.place}>
    <label>{label}<input aria-label={label} value={query} autoComplete="off" placeholder={ready ? "Search Ola Maps in Bengaluru" : "Loading Ola Maps…"} disabled={disabled || !ready} onChange={event => { generation.current++; setQuery(event.target.value); setSuggestions([]); setError(""); onChange(undefined); }} /></label>
    {value && <small className={styles.selected}>✓ Place selected</small>}
    {busy && <small>Searching…</small>}
    {!!suggestions.length && <div className={styles.suggestions} role="listbox" aria-label={`${label} suggestions`}>
      {suggestions.map((suggestion) => <button key={suggestion.placeId} type="button" disabled={disabled} onClick={() => void choose(suggestion)}>{suggestion.description}</button>)}
    </div>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
