"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { request } from "../lib/legacy-api";
import LocalAccountSignIn from "./LocalAccountSignIn";
import StudentSignIn from "./StudentSignIn";

type Props = {
  request: typeof request;
  busy: boolean;
  error: string;
  onSignedIn: (token: string, role: "rider" | "driver") => Promise<void>;
  adminEmail: string;
  adminPassword: string;
  onAdminEmailChange: (email: string) => void;
  onAdminPasswordChange: (password: string) => void;
  onAdminSignIn: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

/** The unsigned-in experience is presentational; account/session ownership stays in Page. */
export default function LocalAccountLanding({
  request, busy, error, onSignedIn, adminEmail, adminPassword,
  onAdminEmailChange, onAdminPasswordChange, onAdminSignIn,
}: Props) {
  // Build-time public-stage flag prevents any initial synthetic-form flash.
  // Laravel independently enforces the verified-student boundary.
  const forceStudentOnly = process.env.NEXT_PUBLIC_STUDENT_ONLY === "1";
  const [studentOnly, setStudentOnly] = useState(forceStudentOnly);
  useEffect(() => {
    let active = true;
    request("college-auth/config", "")
      .then(result => { if (active) setStudentOnly(forceStudentOnly || result?.student_only === true); })
      .catch(() => { if (active) setStudentOnly(forceStudentOnly); });
    return () => { active = false; };
  }, [request, forceStudentOnly]);
  return (
    <main className="landing">
      <div className="brand"><span className="logo">C</span>CampusPool</div>
      <section className="hero">
        <div>
          <p className="eyebrow">CAMPUS COMMUTE</p>
          <h1>Share the<br /><em>way home.</em></h1>
          <p className="lede">{studentOnly === true
            ? "Sign in with your verified PES student email to find or share a campus commute."
            : "Create separate rider and driver accounts. Use different browser profiles or a normal and private window, so each account keeps its own sign-in while you publish a ride, request a seat, and accept it."}</p>
          {studentOnly
            ? <StudentSignIn request={request} busy={busy} onSignedIn={async token => onSignedIn(token, "rider")} />
            : <LocalAccountSignIn request={request} busy={busy} onSignedIn={onSignedIn} />}
          {!studentOnly && <details className="admin-login">
            <summary>Administrator sign-in</summary>
            <p className="fine">Use an existing administrator account. This form does not create accounts or grant privileges.</p>
            <form onSubmit={onAdminSignIn} className="form-grid">
              <label>Email<input type="email" value={adminEmail} onChange={(event) => onAdminEmailChange(event.target.value)} autoComplete="username" required /></label>
              <label>Administrator password<input type="password" value={adminPassword} onChange={(event) => onAdminPasswordChange(event.target.value)} autoComplete="current-password" required /></label>
              <button className="secondary wide" type="submit" disabled={busy}>Sign in as administrator</button>
            </form>
          </details>}
          {error && <p className="error">{error}</p>}
          <p className="fine">{studentOnly === true
            ? "Verified student access · development pilot; payments and GPS are not live."
            : "Local classroom demo · synthetic credits only"}</p>
        </div>
        <div className="hero-art"><div className="sun" /><div className="road" /></div>
      </section>
    </main>
  );
}
