"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./AddressRides.module.css";

export type AddressPlace = { label: string; lat: number; lng: number };
type Suggestion = { id: string; label: string; prediction: any };

export default function AddressPlacePicker({ label, value, ready, disabled, onChange }: {
  label: string;
  value?: AddressPlace;
  ready: boolean;
  disabled?: boolean;
  onChange: (place?: AddressPlace) => void;
}) {
  const [query, setQuery] = useState(value?.label || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const listId = useId();

  useEffect(() => { if (value) setQuery(value.label); }, [value]);

  useEffect(() => {
    if (!ready || value || query.trim().length < 3) return;
    const requestId = ++generation.current;
    const timeout = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const { AutocompleteSuggestion } = await (window as any).google.maps.importLibrary("places");
        const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(), includedRegionCodes: ["in"],
          locationBias: { south: 12.65, north: 13.35, west: 77.2, east: 77.95 },
        });
        if (generation.current !== requestId) return;
        const next = (result.suggestions || []).flatMap((item: any) => {
          const prediction = item.placePrediction;
          const text = prediction?.text?.text || "";
          return prediction?.toPlace && text ? [{ id: prediction.placeId || text, label: text, prediction }] : [];
        }).slice(0, 6);
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
      } catch {
        if (generation.current === requestId) setError("Address suggestions could not load. Try again.");
      } finally {
        if (generation.current === requestId) setBusy(false);
      }
    }, 250);
    return () => { clearTimeout(timeout); generation.current++; };
  }, [query, value, ready]);

  async function select(suggestion: Suggestion) {
    const requestId = ++generation.current;
    setSuggestions([]);
    setActiveIndex(-1);
    setBusy(true);
    setError("");
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "displayName", "location"] });
      if (generation.current !== requestId) return;
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw Error("Missing coordinates");
      if (lat < 12.65 || lat > 13.35 || lng < 77.2 || lng > 77.95) {
        setError("Choose a location in Bengaluru.");
        return;
      }
      const selected = { label: place.formattedAddress || place.displayName || suggestion.label, lat, lng };
      setQuery(selected.label);
      onChange(selected);
    } catch {
      if (generation.current === requestId) setError("This address could not load. Select it again.");
    } finally {
      if (generation.current === requestId) setBusy(false);
    }
  }

  return <div className={styles.place} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setSuggestions([]); setActiveIndex(-1); }
  }}>
    <label>{label}<input type="search" value={query} placeholder={ready ? "Search an address or landmark" : "Loading address search…"}
      disabled={disabled || !ready} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0}
      aria-controls={suggestions.length ? listId : undefined}
      aria-activedescendant={suggestions.length && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault(); generation.current++; setSuggestions([]); setActiveIndex(-1); setBusy(false);
        } else if (suggestions.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        } else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
          event.preventDefault(); void select(suggestions[activeIndex]);
        }
      }}
      onChange={event => {
        generation.current++;
        setQuery(event.target.value);
        setSuggestions([]);
        setActiveIndex(-1);
        setBusy(false);
        setError("");
        onChange(undefined);
      }} /></label>
    {suggestions.length > 0 && <div id={listId} role="listbox" className={styles.suggestions} aria-label={`${label} suggestions`}>
      {suggestions.map((suggestion, index) => <button id={`${listId}-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} key={suggestion.id}
        onClick={() => void select(suggestion)}>{suggestion.label}</button>)}
    </div>}
    {busy && <small role="status">Finding address…</small>}
    {error && <small className={styles.error} role="alert">{error}</small>}
  </div>;
}
