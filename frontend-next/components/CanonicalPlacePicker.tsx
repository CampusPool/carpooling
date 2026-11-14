"use client";

import { useEffect, useRef, useState } from "react";
import { olaAutocomplete, olaDetails } from "../lib/ola-client";

type Point = { id: number; name: string; lat?: number; lng?: number };
type Suggestion = { key: string; label: string; prediction: any };

const text = (value: any) => typeof value === "string" ? value.trim() : typeof value?.text === "string" ? value.text.trim() : "";
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** A Google address is only a starting point: rides use operator-approved catalog stops. */
export default function CanonicalPlacePicker({ label, name, points, token, disabled, mapsReady = true, onSelect }: {
  label: string; name: string; points: Point[]; token: string; disabled?: boolean; mapsReady?: boolean;
  onSelect?: (point: Point | undefined) => void;
}) {
  const useOlaMaps = process.env.NEXT_PUBLIC_MAP_PROVIDER === "ola";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Point>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nearby, setNearby] = useState<Array<{ point: Point; km: number }>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3 || selected || (!useOlaMaps && !mapsReady)) { setSuggestions([]); return; }
    const current = ++generation.current;
    const timer = setTimeout(async () => {
      setBusy(true); setMessage("");
      try {
        if (useOlaMaps) {
          const result = await olaAutocomplete(term, token);
          if (current !== generation.current) return;
          setSuggestions((result.predictions || []).slice(0, 5).map((item) => ({
            prediction: { placeId: item.placeId }, label: item.description, key: item.placeId,
          })));
        } else {
          const g = (window as any).google;
          const places = g?.maps?.importLibrary ? await g.maps.importLibrary("places") : g?.maps?.places;
          const result = await places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions({ input: term, includedRegionCodes: ["in"] });
          if (current !== generation.current) return;
          setSuggestions((result?.suggestions || []).flatMap((item: any) => {
            const prediction = item.placePrediction;
            const labelText = text(prediction?.text) || text(prediction?.description);
            return prediction?.toPlace && labelText ? [{ prediction, label: labelText, key: prediction.placeId || labelText }] : [];
          }).slice(0, 5));
          if (!places?.AutocompleteSuggestion) setMessage("Google Places is unavailable. Search by the configured pickup point name below.");
        }
      } catch {
        if (current === generation.current) { setSuggestions([]); setMessage("Address search is unavailable. Choose a pickup point below."); }
      } finally { if (current === generation.current) setBusy(false); }
    }, 250);
    return () => { generation.current++; clearTimeout(timer); };
  }, [query, selected, mapsReady, useOlaMaps, token]);

  async function choose(suggestion: Suggestion) {
    const current = ++generation.current;
    setSuggestions([]); setNearby([]); setMessage("Finding nearby pickup points…");
    try {
      let lat: number, lng: number, address: string;
      if (useOlaMaps) {
        const result = await olaDetails(suggestion.prediction.placeId, token);
        lat = result.place.lat; lng = result.place.lng; address = result.place.label;
      } else {
        const place = suggestion.prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        lat = typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat;
        lng = typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng;
        address = place.formattedAddress || suggestion.label;
      }
      if (current !== generation.current) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw Error("Coordinates unavailable");
      const nearest = points.flatMap((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)
        ? [{ point, km: distanceKm({ lat, lng }, { lat: Number(point.lat), lng: Number(point.lng) }) }]
        : []).sort((a, b) => a.km - b.km).slice(0, 5);
      setQuery(address);
      setNearby(nearest);
      setMessage(nearest.length ? "Choose a nearby pickup point." : "Choose a pickup point below.");
    } catch {
      if (current === generation.current) setMessage("This address could not load. Choose a pickup point below.");
    }
  }

  function selectPoint(point: Point) {
    generation.current++;
    setSelected(point); onSelect?.(point); setQuery(point.name); setNearby([]); setSuggestions([]);
    setMessage("Pickup point selected.");
  }

  return <div className="canonical-place-picker">
    <label>Search {label.toLowerCase()} by address<input type="search" value={query} disabled={disabled} autoComplete="off" placeholder="Type an address" onChange={(event) => { setQuery(event.target.value); setSelected(undefined); onSelect?.(undefined); setNearby([]); setMessage(""); }} /></label>
    <input type="hidden" name={name} value={selected?.id ?? ""} />
    {busy && <small className="fine">Searching {useOlaMaps ? "Ola" : "Google"} Places…</small>}
    {suggestions.length > 0 && <div className="canonical-place-suggestions" role="listbox" aria-label={`${label} address suggestions`}>
      {suggestions.map((item) => <button key={item.key} type="button" disabled={disabled} onClick={() => void choose(item)}>{item.label}</button>)}
    </div>}
    {nearby.length > 0 && <div className="canonical-place-suggestions" aria-label="Nearby pickup points">
      {nearby.map(({ point, km }) => <button key={point.id} type="button" disabled={disabled} onClick={() => selectPoint(point)}>{point.name} <small>· {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} from address</small></button>)}
    </div>}
    {points.length > 0 && <label className="canonical-point-fallback">{label}<select value={selected?.id ?? ""} disabled={disabled} onChange={(event) => { const point = points.find((candidate) => candidate.id === Number(event.target.value)); if (point) selectPoint(point); else { setSelected(undefined); onSelect?.(undefined); setQuery(""); } }}>
      <option value="">Choose pickup point</option>{points.map((point) => <option value={point.id} key={point.id}>{point.name}</option>)}
    </select></label>}
    {message && <small className="fine" role="status">{message}</small>}
  </div>;
}
