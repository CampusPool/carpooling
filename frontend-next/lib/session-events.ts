/** Scope unauthorized responses to the bearer token that actually failed. */
export function emitUnauthorized(token: string) {
  if (!token || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mobility:unauthorized", { detail: { token } }));
}

/** A delayed response from an older login must never invalidate the new login. */
export function isCurrentUnauthorized(event: Event, currentToken: string) {
  const rejected = (event as CustomEvent<{ token?: string }>).detail?.token;
  return Boolean(currentToken && rejected && rejected === currentToken);
}
