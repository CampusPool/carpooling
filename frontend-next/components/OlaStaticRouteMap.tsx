"use client";
import { useEffect, useState } from "react";
import { decodeOlaPolyline, olaDirections, type OlaPlace } from "../lib/ola-client";

type Props = { token: string; origin?: OlaPlace; destination?: OlaPlace; geometry?: unknown };
export default function OlaStaticRouteMap({ token, origin, destination, geometry }: Props) {
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("Loading route map…");
  useEffect(() => {
    let active = true, url = "";
    const controller = new AbortController();
    async function load() {
      try {
        let coordinates: [number, number][];
        if (Array.isArray(geometry) && geometry.length > 1) coordinates = geometry;
        else if (origin && destination) coordinates = decodeOlaPolyline((await olaDirections([origin, destination], token)).encodedPolyline);
        else return;
        const stride = Math.max(1, Math.ceil((coordinates.length - 1) / 98));
        const sample = coordinates.filter((_, index) => index % stride === 0 || index === coordinates.length - 1);
        const response = await fetch("/api/ola/static-map", { method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ points: sample.map(([lng, lat]) => ({ lat, lng })) }), cache: "no-store" });
        if (!response.ok) throw Error("Map unavailable");
        const blob = await response.blob();
        if (!active) return;
        url = URL.createObjectURL(blob); setImage(url); setMessage("");
      } catch { if (active) setMessage("Route map is temporarily unavailable."); }
    }
    setImage(""); setMessage("Loading route map…"); void load();
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [token, origin, destination, geometry]);
  return <div>{image && <img src={image} alt="Ola map of the ride route" style={{ width: "100%", borderRadius: 12 }} />}
    {message && <p role="status">{message}</p>}</div>;
}
