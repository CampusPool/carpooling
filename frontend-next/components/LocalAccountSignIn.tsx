"use client";

import { useEffect, useState, type FormEvent } from "react";

type Request = (path: string, token: string, method?: string, json?: Record<string, unknown>) => Promise<any>;

export default function LocalAccountSignIn({ request, busy, onSignedIn }: {
  request: Request;
  busy: boolean;
  onSignedIn: (token: string, role: "rider" | "driver") => Promise<void>;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    request("local-auth/config", "").then(result => { if (active) setEnabled(result.enabled === true); })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, [request]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await request(`local-auth/${mode}`, "", "POST", {
        username: username.trim(), password, ...(mode === "register" ? { role } : {}),
      });
      if (typeof result.token !== "string" || !result.token || !["rider", "driver"].includes(result.role)) {
        throw new Error("Sign-in did not return a valid account session.");
      }
      setPassword("");
      await onSignedIn(result.token, result.role);
    } catch (e: any) {
      const code = e?.code;
      setError(code === "USERNAME_TAKEN" ? "That username is already in use." : code === "INVALID_CREDENTIALS"
        ? "Username or password is incorrect." : e?.message || "Could not complete account sign-in.");
    } finally { setPending(false); }
  }

  if (enabled === null) return <p className="fine" role="status">Checking local account availability…</p>;
  if (!enabled) return <p className="fine">Username and password accounts are available in the local pilot environment.</p>;
  return <section className="local-account-login" aria-labelledby="local-account-title">
    <h2 id="local-account-title">Local demo account</h2>
    <p className="fine">Create a rider or driver account with a username and password. This account is stored only in the local demo database.</p>
    <form onSubmit={submit} className="form-grid">
      <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} maxLength={72} required /></label>
      {mode === "register" && <label>Account type<select value={role} onChange={e => setRole(e.target.value as "rider" | "driver")}><option value="rider">Rider</option><option value="driver">Driver</option></select></label>}
      <button type="submit" className="secondary wide" disabled={busy || pending}>{mode === "register" ? "Create account" : "Sign in"}</button>
    </form>
    <button type="button" className="text-button" disabled={pending} onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>
      {mode === "register" ? "Already registered? Sign in" : "New here? Create an account"}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
