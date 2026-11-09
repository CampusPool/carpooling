"use client";

import { emitUnauthorized } from "./session-events";

export type Json = Record<string, any>;

export async function api(path: string, token: string, method = "GET", body?: Json, key?: string) {
  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  if (body) headers.set("Content-Type", "application/json");
  if (key) headers.set("Idempotency-Key", key);
  const response = await fetch(`/api/mobility/commute/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized(token);
    const code = data?.error?.code || data?.error;
    const copy: Record<string, string> = {
      ROUTE_PROVIDER_UNAVAILABLE: "Road routing is temporarily unavailable. Please try again.",
      NO_ROUTE: "No driving route is available between these places.",
      COMMUTE_QUOTE_CHANGED: "This result has changed. Search again before requesting a seat.",
      COMMUTE_TRIP_CLOSED: "This ride has already departed or closed.",
      NOT_SEAT_AVAILABLE: "This ride is full. Search for another ride.",
      WAITLIST_NOT_ACTIONABLE: "No seat is available for your turn yet. Try again when a seat opens.",
      WAITLIST_NOT_YOUR_TURN: "Another rider is ahead of you in the waitlist. Check back later.",
      WAITLIST_ONLY_WHEN_FULL: "This ride still has seats. Request a seat directly instead.",
      WAITLIST_CONSENT_REQUIRED: "Review and accept the refreshed route and fare first.",
      INSUFFICIENT_DEMO_CREDITS: "Not enough demo credits. Open Your account activity, add demo credits, then confirm payment.",
      PAYMENT_RELEASE_REQUIRED: "Demo credits have not been released to the driver yet.",
      COMMUTE_BUSY_RETRY: "The ride is being updated. Please try again.",
    };
    const error = new Error(copy[code] || data?.message || data?.error?.message || (typeof code === "string" ? code.replaceAll("_", " ") : `Request failed (${response.status}).`));
    Object.assign(error, { status: response.status, code });
    throw error;
  }
  return data;
}
