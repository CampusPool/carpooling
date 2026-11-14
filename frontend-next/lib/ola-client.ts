/** Browser-only CampusPool proxy client; API credentials are never sent by callers. */
export type OlaPlace = { lat: number; lng: number; label: string };
export type OlaSuggestion = { placeId: string; description: string };

export function decodeOlaPolyline(encoded: string): Array<[number, number]> {
  if (typeof encoded !== "string" || !encoded || encoded.length > 300000) throw new Error("Invalid Ola route geometry.");
  let lat = 0, lng = 0, pos = 0;
  const points: Array<[number, number]> = [];
  while (pos < encoded.length) {
    for (const kind of ["lat", "lng"] as const) {
      let value = 0, shift = 0, char: number;
      do {
        if (pos >= encoded.length || shift > 35) throw new Error("Invalid Ola route geometry.");
        char = encoded.charCodeAt(pos++) - 63;
        if (char < 0 || char > 63) throw new Error("Invalid Ola route geometry.");
        value |= (char & 31) << shift;
        shift += 5;
      } while (char >= 32);
      const delta = value & 1 ? ~(value >>> 1) : value >>> 1;
      if (kind === "lat") lat += delta;
      else lng += delta;
    }
    const point: [number, number] = [lng / 100000, lat / 100000];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) {
      throw new Error("Invalid Ola route geometry.");
    }
    points.push(point);
    if (points.length > 20000) throw new Error("Ola route geometry exceeded safety limits.");
  }
  if (points.length < 2) throw new Error("Invalid Ola route geometry.");
  return points;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const result = await fetch(`/api/ola/${path}`, {
    ...init, cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) {
    const code = body?.error?.code;
    if (result.status === 429) throw new Error("Ola Maps request allowance reached. Please wait before trying again.");
    if (result.status === 401) throw new Error("Sign in again to use maps.");
    if (result.status === 503) throw new Error("Ola Maps is not configured or is temporarily unavailable.");
    throw new Error(typeof code === "string" ? code.replaceAll("_", " ") : "Ola Maps request failed.");
  }
  return body as T;
}

export const olaConfig = (token: string) => request<{ provider: string; browserKey: string }>("config", token);
export const olaAutocomplete = (input: string, token: string) => request<{ predictions: OlaSuggestion[] }>(`autocomplete?input=${encodeURIComponent(input)}`, token);
export const olaDetails = (placeId: string, token: string) => request<{ place: OlaPlace }>(`details?place_id=${encodeURIComponent(placeId)}`, token);
export const olaDirections = (points: OlaPlace[], token: string, mode: "driving" | "walking" | "bike" = "driving") =>
  request<{ distanceMeters: number; durationSeconds: number; encodedPolyline: string }>("directions", token,
    { method: "POST", body: JSON.stringify({ points: points.map(({ lat, lng }) => ({ lat, lng })), mode }) });
