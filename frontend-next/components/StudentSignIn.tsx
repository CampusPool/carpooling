"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatOtpCountdown, normalizeStudentEmail } from "../lib/student-email";

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
  const [expiryAt, setExpiryAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    let active = true;
    request("college-auth/config", "").then(result => {
      if (active && Array.isArray(result.campuses)) setCampuses(result.campuses.filter((item: unknown): item is string => typeof item === "string"));
    }).catch(() => { if (active) setCampuses([]); });
    return () => { active = false; };
  }, [request]);

  useEffect(() => {
    if (!challenge) return;
    const refresh = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expiryAt - Date.now()) / 1000)));
      setResendSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [challenge, expiryAt, resendAt]);

  async function issueCode() {
    const normalized = normalizeStudentEmail(email);
    if (!normalized) {
      setError("Use your exact @stu.pes.edu student email address.");
      return;
    }
    setPending(true); setError("");
    try {
      const result = await request("college-auth/request", "", "POST", { email: normalized });
      if (typeof result.challenge_id !== "string" || !result.challenge_id) throw new Error("Could not start sign-in. Please try again.");
      const ttl = typeof result.expires_in === "number" ? result.expires_in : 300;
      const cooldown = typeof result.resend_after === "number" ? result.resend_after : 60;
      setEmail(normalized); setChallenge(result.challenge_id); setCode("");
      setExpiryAt(Date.now() + ttl * 1000);
      setResendAt(Date.now() + cooldown * 1000);
      setSecondsLeft(ttl);
      setResendSeconds(cooldown);
    } catch (e: any) { setError(e?.message || "Could not send a sign-in code."); }
    finally { setPending(false); }
  }
  function sendCode(event: FormEvent) { event.preventDefault(); void issueCode(); }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const result = await request("college-auth/verify", "", "POST", {
        challenge_id: challenge, code,
        ...(newStudent ? { name: name.trim(), srn: srn.trim(), campus_code: campus } : {}),
      });
      if (typeof result.token !== "string" || !result.token) throw new Error("Sign-in did not return a session.");
      await onSignedIn(result.token);
      setCode("");
    } catch (e: any) {
      if (e?.code === "STUDENT_NAME_INVALID") {
        setNewStudent(true);
        setError("First sign-in? Complete your student profile below, then verify again.");
      } else {
        setError(e?.message || "Could not verify the code.");
      }
    } finally { setPending(false); }
  }

  return <details className="admin-login">
    <summary>Student sign-in or registration</summary>
    <p className="fine">Verify your @stu.pes.edu email using a six-digit code, valid for five minutes. Never enter your college portal password.</p>
    {!challenge ? <form onSubmit={sendCode} className="form-grid">
      <label>College email<input type="email" autoComplete="email" placeholder="student@stu.pes.edu" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <button type="submit" className="secondary wide" disabled={busy || pending}>Send code</button>
    </form> : <form onSubmit={verifyCode} className="form-grid">
      <p className="fine">Enter the six-digit code sent to {email}.</p>
      <p className="fine" role="status">{secondsLeft > 0 ? "Code expires in " + formatOtpCountdown(secondsLeft) : "Code expired. Request a new one."}</p>
      <label>Verification code<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      <label><input type="checkbox" checked={newStudent} onChange={e => setNewStudent(e.target.checked)} /> I need to complete my student profile</label>
      {newStudent && <>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
        <label>SRN<input value={srn} onChange={e => setSrn(e.target.value)} required /></label>
        <label>Campus<select value={campus} onChange={e => setCampus(e.target.value)} required><option value="">Select campus</option>{campuses.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        {campuses.length === 0 && <p className="error">Campus options are unavailable. Please try again later.</p>}
      </>}
      <button type="submit" className="secondary wide" disabled={busy || pending || secondsLeft <= 0}>Verify and sign in</button>
      <button type="button" className="secondary wide" disabled={busy || pending || resendSeconds > 0} onClick={() => void issueCode()}>
        {resendSeconds > 0 ? "Resend available in " + formatOtpCountdown(resendSeconds) : "Resend a new code"}
      </button>
      <button type="button" className="secondary wide" disabled={pending} onClick={() => { setChallenge(""); setCode(""); setError(""); }}>Use a different email</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}
  </details>;
}
