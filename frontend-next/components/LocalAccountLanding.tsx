"use client";

import type { FormEvent } from "react";
import type { request } from "../lib/legacy-api";
import LocalAccountSignIn from "./LocalAccountSignIn";

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
