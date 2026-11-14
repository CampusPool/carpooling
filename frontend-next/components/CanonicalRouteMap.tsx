"use client";

import { useEffect, useRef, useState } from "react";

type Point = { id: number; name: string; lat?: number; lng?: number };

function position(point: Point | undefined) {
  return point && typeof point.lat === "number" && typeof point.lng === "number"
    && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    ? { lat: point.lat, lng: point.lng } : undefined;
}

export default function CanonicalRouteMap({ pickup, dropoff, points, geometry, previewLabel = "Driving preview" }: {
  pickup?: Point;
  dropoff?: Point;
  points: Point[];
  geometry?: unknown;
  previewLabel?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    const google = (window as any).google;
    Promise.resolve().then(() => google?.maps?.importLibrary("maps")).then(library => {
      if (!library) throw Error("Map unavailable");
      return library;
    }).then(({ Map }: any) => {
      if (!active || !element.current) return;
      map.current = new Map(element.current, {
        center: { lat: 12.934, lng: 77.535 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
      });
      setReady(true);
    }).catch(() => {
      if (active) setStatus("The map could not load. You can still choose pickup points by name.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    let active = true;
    const google = (window as any).google;
    const from = position(pickup);
    const to = position(dropoff);
    const pins = from || to ? [pickup, dropoff] : points;
    const markers = pins.flatMap((point) => {
      const location = position(point);
      return location ? [new google.maps.Marker({ map: map.current, position: location, title: point?.name })] : [];
    });
    if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => bounds.extend(marker.getPosition()));
      map.current.fitBounds(bounds, 50);
    } else if (markers[0]) {
      map.current.panTo(markers[0].getPosition());
    }

    let line: any;
    setStatus("");
    const savedPath = Array.isArray(geometry) ? geometry.flatMap(point =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
        ? [{ lng: point[0], lat: point[1] }] : []
    ) : [];
    if (savedPath.length > 1) {
      line = new google.maps.Polyline({ map: map.current, path: savedPath, strokeColor: "#1857dc", strokeWeight: 5 });
      const bounds = new google.maps.LatLngBounds();
      savedPath.forEach(location => bounds.extend(location));
      markers.forEach(marker => bounds.extend(marker.getPosition()));
      map.current.fitBounds(bounds, 50);
      setStatus("Published route");
    } else if (from && to && pickup?.id !== dropoff?.id) {
      setStatus("Loading driving preview…");
      void google.maps.importLibrary("routes").then(async ({ Route }: any) => {
        const result = await Route.computeRoutes({
          origin: { location: from },
          destination: { location: to },
          travelMode: "DRIVING",
          fields: ["path", "distanceMeters", "durationMillis"],
        });
        if (!active) return;
        const route = result.routes?.[0];
        if (!route?.path?.length) throw new Error("Route unavailable");
        line = new google.maps.Polyline({ map: map.current, path: route.path, strokeColor: "#1857dc", strokeWeight: 5 });
        const bounds = new google.maps.LatLngBounds();
        route.path.forEach((location: any) => bounds.extend(location));
        map.current.fitBounds(bounds, 50);
        setStatus(`${previewLabel} · ${(route.distanceMeters / 1000).toFixed(1)} km · about ${Math.max(1, Math.round(route.durationMillis / 60000))} min`);
      }).catch(() => {
        if (active) setStatus("Driving preview is unavailable. You can still search for rides.");
      });
    }
    return () => {
      active = false;
      markers.forEach((marker) => marker.setMap(null));
      line?.setMap(null);
    };
  }, [ready, pickup, dropoff, points, geometry, previewLabel]);

  return <div style={{ marginBlock: 16 }}>
    <div ref={element} aria-label="Google map of the ride route" style={{ width: "100%", height: 280, borderRadius: 12 }} />
    {status && <p className="fine" role="status">{status}</p>}
  </div>;
}
