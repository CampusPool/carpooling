export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  constructor(message: string, status = 500, code?: string, fields?: Record<string, string>) {
    super(message); this.name = "ApiError"; this.status = status; this.code = code; this.fields = fields;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  }
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.message ?? "We could not complete that request.", response.status, payload?.error?.code, payload?.error?.fields);
  return (payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload) as T;
}
