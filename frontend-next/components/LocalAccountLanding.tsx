"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { request } from "../lib/legacy-api";
import LocalAccountSignIn from "./LocalAccountSignIn";
import StudentSignIn from "./StudentSignIn";
import styles from "./StudentSignIn.module.css";

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
  if (studentOnly) {
    return (
      <main className={styles.landing}>
        <header className={styles.brand}>
          <span aria-hidden="true" className={styles.mark}>C</span>
          CampusPool
        </header>
        <div className={styles.layout}>
          <section className={styles.intro} aria-labelledby="student-intro">
            <h1 id="student-intro">Share a ride<br />to campus.</h1>
            <p>Find a seat with another PES student or offer a ride on your campus commute.</p>
          </section>
          <StudentSignIn request={request} busy={busy} onSignedIn={token => onSignedIn(token, "rider")} />
        </div>
        {error && <p className={styles.pageError} role="alert">{error}</p>}
      </main>
    );
  }

  return (
    <main className="landing">
      <div className="brand"><span className="logo">C</span>CampusPool</div>
      <section className="hero">
        <div>
          <p className="eyebrow">CAMPUS COMMUTE</p>
          <h1>Share the<br /><em>way home.</em></h1>
          <p className="lede">Create separate rider and driver accounts. Use different browser profiles or a normal and private window, so each account keeps its own sign-in while you publish a ride, request a seat, and accept it.</p>
          <LocalAccountSignIn request={request} busy={busy} onSignedIn={onSignedIn} />
          <details className="admin-login">
            <summary>Administrator sign-in</summary>
            <p className="fine">Use an existing administrator account. This form does not create accounts or grant privileges.</p>
            <form onSubmit={onAdminSignIn} className="form-grid">
              <label>Email<input type="email" value={adminEmail} onChange={(event) => onAdminEmailChange(event.target.value)} autoComplete="username" required /></label>
              <label>Administrator password<input type="password" value={adminPassword} onChange={(event) => onAdminPasswordChange(event.target.value)} autoComplete="current-password" required /></label>
              <button className="secondary wide" type="submit" disabled={busy}>Sign in as administrator</button>
            </form>
          </details>
          {error && <p className="error">{error}</p>}
          <p className="fine">Local classroom demo · synthetic credits only</p>
        </div>
        <div className="hero-art"><div className="sun" /><div className="road" /></div>
      </section>
    </main>
  );
}
