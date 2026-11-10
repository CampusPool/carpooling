"use client";

import { useEffect, useRef, useState } from "react";
import { decodeOlaPolyline, olaConfig, olaDirections, type OlaPlace } from "../lib/ola-client";
import styles from "./LiveCarpool.module.css";

type Props = {
  token: string; origin?: OlaPlace; destination?: OlaPlace; geometry?: [number, number][]; pick: "origin" | "destination" | null;
  onPick: (kind: "origin" | "destination", value: OlaPlace) => void;
  onState: (ready: boolean) => void; onError: (message: string) => void;
};

export default function OlaMapPanel({ token, origin, destination, geometry, pick, onPick, onState, onError }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const callbacks = useRef({ pick, onPick, onState, onError });
  callbacks.current = { pick, onPick, onState, onError };
  const [loaded, setLoaded] = useState(false);
  const [routeSummary, setRouteSummary] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const config = await olaConfig(token);
        if (!active || !element.current || config.provider !== "ola" || !config.browserKey) return;
        const { OlaMaps } = await import("olamaps-web-sdk");
        if (!active || !element.current) return;
        const sdk = new OlaMaps({ apiKey: config.browserKey });
        const live = await sdk.init({
          style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
          container: element.current, center: [77.5946, 12.9716], zoom: 12,
        });
        if (!active) { live.remove?.(); return; }
        map.current = live;
        const ready = () => { if (active) { setLoaded(true); callbacks.current.onState(true); } };
        live.on("load", ready);
        live.on("fail", () => { if (active) callbacks.current.onError("Ola map tiles could not load."); });
        live.on("click", (event: any) => {
          const selected = callbacks.current.pick;
          if (!active || !selected || !event?.lngLat) return;
          const lat = Number(event.lngLat.lat), lng = Number(event.lngLat.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 12.65 || lat > 13.35 || lng < 77.2 || lng > 77.95) {
            callbacks.current.onError("Select a point inside the Bengaluru campus region."); return;
          }
          callbacks.current.onPick(selected, { lat, lng, label: `Map point (${lat.toFixed(5)}, ${lng.toFixed(5)})` });
        });
        if (live.loaded?.()) ready();
      } catch {
        if (active) callbacks.current.onError("The Ola map could not load. Check SDK access, key restrictions and network.");
      }
    })();
    return () => { active = false; callbacks.current.onState(false); map.current?.remove?.(); map.current = null; };
  }, [token]);
  useEffect(() => {
    if (!loaded || !map.current) return;
    const serial = ++generation.current;
    let active = true;
    async function draw() {
      const current = map.current;
      if (!current) return;
      if ((!origin || !destination) && !(geometry && geometry.length > 1)) {
        setRouteSummary("");
        if (current.getLayer?.("campuspool-route")) current.removeLayer("campuspool-route");
        if (current.getSource?.("campuspool-route")) current.removeSource("campuspool-route");
        return;
      }
      setRouteSummary("Finding a driving route…");
      try {
        // Display persisted geometry without spending another Directions request.
        // The persisted canonical route may include more than two stops.
        if (geometry && (geometry.length > 20000 || geometry.some((point) => !Array.isArray(point) || point.length !== 2 ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90))) {
          throw new Error("The saved route geometry is invalid.");
        }
        const route = geometry?.length ? undefined : await olaDirections([origin!, destination!], token);
        if (!active || serial !== generation.current || !map.current) return;
        const points = geometry?.length ? geometry : decodeOlaPolyline(route!.encodedPolyline);
        const featureCollection = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points } }] };
        if (current.getSource?.("campuspool-route")) current.getSource("campuspool-route").setData(featureCollection);
        else {
          current.addSource("campuspool-route", { type: "geojson", data: featureCollection });
          current.addLayer({ id: "campuspool-route", type: "line", source: "campuspool-route", paint: { "line-color": "#176b5b", "line-width": 5 } });
        }
        const lngs = points.map(p => p[0]); const lats = points.map(p => p[1]);
        current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 54, maxZoom: 16 });
        setRouteSummary(route
          ? `${(route.distanceMeters / 1000).toFixed(1)} km · about ${Math.max(1, Math.round(route.durationSeconds / 60))} min driving`
          : "Saved ride route geometry");
      } catch (cause) {
        if (active && serial === generation.current) setRouteSummary(cause instanceof Error ? cause.message : "Ola route preview is unavailable.");
      }
    }
    void draw();
    return () => { active = false; generation.current++; };
  }, [token, origin, destination, geometry, loaded]);
  return <div className={styles.mapPanel}>
    <div className={styles.map} ref={element} aria-label="Ola map of your selected route" />
    <p>{routeSummary || "Select your pickup and destination to preview the route on Ola Maps."}</p>
  </div>;
}
