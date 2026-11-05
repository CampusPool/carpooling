"use client";

import { useEffect, useState, type FormEvent } from "react";

type Request = (path: string, token: string, method?: string, json?: Record<string, unknown>) => Promise<any>;

export default function StudentSignIn({ request, onSignedIn, busy }: { request: Request; onSignedIn: (token: string) => Promise<void>; busy: boolean }) {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [srn, setSrn] = useState("");
  const [campus, setCampus] = useState("");
  const [newStudent, setNewStudent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [campuses, setCampuses] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    request("college-auth/config", "").then(result => {
      if (active && Array.isArray(result.campuses)) setCampuses(result.campuses.filter((item: unknown): item is string => typeof item === "string"));
    }).catch(() => { if (active) setCampuses([]); });
    return () => { active = false; };
  }, [request]);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const result = await request("college-auth/request", "", "POST", { email: email.trim() });
      if (typeof result.challenge_id !== "string" || !result.challenge_id) throw new Error("Could not start sign-in. Please try again.");
      setChallenge(result.challenge_id);
    } catch (e: any) { setError(e?.message || "Could not send a sign-in code."); }
    finally { setPending(false); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const result = await request("college-auth/verify", "", "POST", {
        challenge_id: challenge, code,
        ...(newStudent ? { name: name.trim(), srn: srn.trim(), campus_code: campus.trim() } : {}),
      });
      if (typeof result.token !== "string" || !result.token) throw new Error("Sign-in did not return a session.");
      await onSignedIn(result.token);
      setCode("");
    } catch (e: any) { setError(e?.message || "Could not verify the code."); }
    finally { setPending(false); }
  }

  return <details className="admin-login">
    <summary>Student sign-in or registration</summary>
    <p className="fine">We will send a code to your college email. Never enter your college portal password.</p>
    {!challenge ? <form onSubmit={sendCode} className="form-grid">
      <label>College email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <button type="submit" className="secondary wide" disabled={busy || pending}>Send code</button>
    </form> : <form onSubmit={verifyCode} className="form-grid">
      <p className="fine">Enter the code sent to {email}.</p>
      <label>Verification code<input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      <label><input type="checkbox" checked={newStudent} onChange={e => setNewStudent(e.target.checked)} /> I need to complete my student profile</label>
      {newStudent && <>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
        <label>SRN<input value={srn} onChange={e => setSrn(e.target.value)} required /></label>
        <label>Campus<select value={campus} onChange={e => setCampus(e.target.value)} required><option value="">Select campus</option>{campuses.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        {campuses.length === 0 && <p className="error">Campus options are unavailable. Please try again later.</p>}
      </>}
      <button type="submit" className="secondary wide" disabled={busy || pending}>Verify and sign in</button>
      <button type="button" className="secondary wide" disabled={pending} onClick={() => { setChallenge(""); setCode(""); setError(""); }}>Use a different email</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}
  </details>;
}
