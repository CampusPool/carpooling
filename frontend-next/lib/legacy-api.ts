"use client";

import { emitUnauthorized } from "./session-events";
import type { R } from "./legacy-ui-utils";

export async function request(
  path: string,
  token: string,
  method = "GET",
  json?: R,
  key?: string,
) {
  const h = new Headers({ Accept: "application/json" });
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (json) {
    h.set("Content-Type", "application/json");
    h.set("Idempotency-Key", key || crypto.randomUUID());
  }
  const endpoint = path.startsWith("admin/") ? `/api/${path}` : `/api/mobility/${path}`;
  const r = await fetch(endpoint, {
    method,
    headers: h,
    body: json ? JSON.stringify(json) : undefined,
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    {
      const code = typeof d.error?.code === "string" ? d.error.code : undefined;
      const messages: Record<string, string> = {
        WAITLIST_NOT_ACTIONABLE: "This waitlist entry is not actionable yet. Refresh when a seat may be available.",
        WAITLIST_NOT_YOUR_TURN: "An earlier rider is still waiting. Refresh the waitlist later.",
        COMMUTE_QUOTE_CHANGED: "Your route or fare changed. Refresh the terms before continuing.",
        COMMUTE_BUSY_RETRY: "The ride is being updated. Please retry.",
        USERNAME_TAKEN: "That username is already in use.",
        INVALID_CREDENTIALS: "Username or password is incorrect.",
        PASSWORD_TOO_LONG_BYTES: "Use a password of no more than 72 bytes.",
        ACCOUNT_ROLE_REQUIRED: "This account type cannot perform that action.",
        COLLEGE_EMAIL_INVALID: "Enter an eligible college email address.",
        COLLEGE_MAIL_UNAVAILABLE: "Email delivery is unavailable. Please try again later.",
        COLLEGE_OTP_INVALID: "That code is incorrect. Please try again.",
        COLLEGE_OTP_EXPIRED: "That code has expired. Request a new code.",
        COLLEGE_OTP_THROTTLED: "Too many attempts. Please try again later.",
        COLLEGE_OTP_RETRY_LATER: "A code was recently sent. Please wait before requesting another.",
        STUDENT_NAME_INVALID: "Enter your full name.",
        STUDENT_SRN_INVALID: "Enter a valid student registration number.",
        STUDENT_CAMPUS_INVALID: "Choose an available campus.",
        STUDENT_SRN_TAKEN: "That student registration number is already in use.",
      };
      const message = (code && messages[code]) || (typeof d.message === "string" ? d.message : undefined) || (typeof d.error?.message === "string" ? d.error.message : undefined) || (typeof d.error === "string" ? d.error : undefined) || "Request failed. Please try again.";
      const error = Error(message);
      (error as Error & { status?: number }).status = r.status;
      (error as Error & { code?: string }).code = code;
      if (r.status === 401 && typeof window !== "undefined") {
        emitUnauthorized(token);
      }
      throw error;
    }
  return d;
}
