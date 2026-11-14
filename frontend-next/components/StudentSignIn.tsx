"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatOtpCountdown, normalizeStudentEmail } from "../lib/student-email";
import styles from "./StudentSignIn.module.css";
import { genderOptions } from "./StudentProfile";

type Request = (path: string, token: string, method?: string, json?: Record<string, unknown>) => Promise<any>;
type Mode = "email" | "login" | "register" | "reset";

export default function StudentSignIn({ request, onSignedIn, busy }: { request: Request; onSignedIn: (token: string) => Promise<void>; busy: boolean }) {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [srn, setSrn] = useState("");
  const [campus, setCampus] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [newStudent, setNewStudent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [campuses, setCampuses] = useState<string[]>([]);
  const [deliveryScope, setDeliveryScope] = useState("");
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [expiryAt, setExpiryAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    let active = true;
    request("college-auth/config", "").then(result => {
      if (active && Array.isArray(result.campuses)) setCampuses(result.campuses.filter((item: unknown): item is string => typeof item === "string"));
      if (active) {
        setDeliveryScope(typeof result.delivery_scope === "string" ? result.delivery_scope : "");
        setDeliveryAvailable(result.delivery_available === true);
      }
    }).catch(() => { if (active) setDeliveryAvailable(false); });
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
  useEffect(() => { if (challenge) codeInput.current?.focus(); }, [challenge]);
  useEffect(() => { if (newStudent) nameInput.current?.focus(); }, [newStudent]);

  async function issueCode() {
    if (!deliveryAvailable || busy || pending) return;
    const normalized = normalizeStudentEmail(email);
    if (!normalized) { setError("Use your @stu.pes.edu email address or PES student SRN."); return; }
    setPending(true); setError("");
    try {
      const result = await request("college-auth/request", "", "POST", { email: normalized });
      if (typeof result.challenge_id !== "string" || !result.challenge_id) throw new Error("Could not start sign-in. Please try again.");
      const ttl = typeof result.expires_in === "number" ? result.expires_in : 300;
      const cooldown = typeof result.resend_after === "number" ? result.resend_after : 60;
      setEmail(normalized); setChallenge(result.challenge_id); setCode("");
      setExpiryAt(Date.now() + ttl * 1000); setResendAt(Date.now() + cooldown * 1000);
      setSecondsLeft(ttl); setResendSeconds(cooldown);
    } catch (e: any) { setError(e?.message || "Could not send a sign-in code."); }
    finally { setPending(false); }
  }
  function sendCode(event: FormEvent) { event.preventDefault(); void issueCode(); }

  async function login(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await request("college-auth/password-login", "", "POST", { username: username.trim(), password });
      if (typeof result.token !== "string" || !result.token) throw new Error("Sign-in did not return a session.");
      // The existing session endpoint sets the protected browser cookie at the edge.
      await request("college-auth/session", result.token, "POST");
      setPassword(""); await onSignedIn(result.token);
    } catch (e: any) { setError(e?.message || "Could not sign in."); }
    finally { setPending(false); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await request("college-auth/verify", "", "POST", {
        challenge_id: challenge, code,
        ...((newStudent || mode === "register") ? { name: name.trim(), srn: srn.trim(), campus_code: campuses.length === 1 ? campuses[0] : campus, gender_identity: gender, phone } : {}),
        ...(mode === "register" ? { password_action: "register", username: username.trim(), password } : {}),
        ...(mode === "reset" ? { password_action: "reset", password } : {}),
      });
      if (typeof result.token !== "string" || !result.token) throw new Error("Sign-in did not return a session.");
      setPassword(""); setCode(""); await onSignedIn(result.token);
    } catch (e: any) {
      if (e?.code === "STUDENT_NAME_INVALID" && mode !== "reset") { setNewStudent(true); setError(""); }
      else setError(e?.message || "Could not verify the code.");
    } finally { setPending(false); }
  }
  function changeEmail() {
    setChallenge(""); setCode(""); setNewStudent(false); setName(""); setSrn("");
    setCampus(""); setGender(""); setPhone(""); setError("");
    requestAnimationFrame(() => emailInput.current?.focus());
  }
  function chooseMode(next: Mode) {
    setMode(next); setChallenge(""); setCode(""); setNewStudent(false);
    setUsername(""); setPassword(""); setError("");
  }
  const mailpit = deliveryScope === "local_capture";
  const heading = challenge ? (newStudent ? "Complete your profile" : "Check your email") :
    mode === "login" ? "Account sign-in" : mode === "register" ? "Create your account" :
      mode === "reset" ? "Reset your password" : "Student sign-in";

  return <section className={styles.card} aria-labelledby="student-signin">
    <h2 id="student-signin">{heading}</h2>
    {!challenge && mode === "login" ? <form onSubmit={login} className={styles.form}>
      <p>Sign in with your CampusPool username and password.</p>
      <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" maxLength={32} required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" maxLength={72} required /></label>
      <button type="submit" className={styles.submit} disabled={busy || pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <button type="button" onClick={() => chooseMode("reset")} disabled={busy || pending}>Forgot password?</button>
    </form> : !challenge ? <>
      <p>{mode === "register" ? "Choose a username and password, then verify your PES email." : mode === "reset" ? "We’ll email a code so you can choose a new password." : "Enter your PES student email or SRN. We’ll email you a six-digit sign-in code."}</p>
      {mailpit && <p className={styles.note} role="note">Test codes are available in Mailpit.</p>}
      {deliveryAvailable === false && <p className={styles.note} role="status">Email sign-in is temporarily unavailable. Try again later.</p>}
      <form onSubmit={sendCode} className={styles.form}>
        <label>College email or SRN
          <input ref={emailInput} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="name@stu.pes.edu" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        {mode === "register" && <>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" pattern="[A-Za-z][A-Za-z0-9_.-]{2,31}" maxLength={32} required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={10} maxLength={72} required /></label>
          <small>Use at least 10 characters.</small>
          <label>Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>
          <label>SRN<input value={srn} onChange={e => setSrn(e.target.value)} autoCapitalize="characters" spellCheck={false} maxLength={32} required /></label>
          <label>Gender<select value={gender} onChange={e => setGender(e.target.value)} required>
            <option value="">Select gender</option>{genderOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+91" maxLength={30} required /></label>
          {campuses.length > 1 && <label>Campus<select value={campus} onChange={e => setCampus(e.target.value)} required><option value="">Select campus</option>{campuses.map(item => <option key={item} value={item}>{item === "CAMPUS-BLR" ? "Bengaluru" : item}</option>)}</select></label>}
          {campuses.length === 0 && <p className={styles.note}>Campus options are unavailable. Please try again later.</p>}
        </>}
        <button type="submit" className={styles.submit} disabled={busy || pending || deliveryAvailable !== true || (mode === "register" && campuses.length === 0)}>{pending ? "Sending code…" : "Send code"}</button>
      </form>
    </> : <form onSubmit={verifyCode} className={styles.form}>
      <p>{mailpit ? "Open Mailpit for the code addressed to " : "Enter the code we sent to "}<strong>{email}</strong>.</p>
      <p className={styles.timer} role="status" aria-live={secondsLeft > 0 ? "off" : "polite"}>{secondsLeft > 0 ? "Code expires in " + formatOtpCountdown(secondsLeft) : "Code expired. Request a new one."}</p>
      <label>Verification code
        <input ref={codeInput} className={styles.code} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      </label>
      {mode === "reset" && <label>New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={10} maxLength={72} required /></label>}
      {newStudent && mode !== "register" && <>
        <label>Full name<input ref={nameInput} value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>SRN<input value={srn} onChange={e => setSrn(e.target.value)} autoCapitalize="characters" spellCheck={false} maxLength={32} required /></label>
        <label>Gender<select value={gender} onChange={e => setGender(e.target.value)} required>
          <option value="">Select gender</option>{genderOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+91" maxLength={30} required /></label>
        {campuses.length > 1 && <label>Campus<select value={campus} onChange={e => setCampus(e.target.value)} required><option value="">Select campus</option>{campuses.map(item => <option key={item} value={item}>{item === "CAMPUS-BLR" ? "Bengaluru" : item}</option>)}</select></label>}
        {campuses.length === 0 && <p className={styles.note}>Campus options are unavailable. Please try again later.</p>}
      </>}
      <button type="submit" className={styles.submit} disabled={busy || pending || secondsLeft <= 0}>{pending ? "Please wait…" : mode === "reset" ? "Reset password and sign in" : "Verify and sign in"}</button>
      <div className={styles.actions}>
        <button type="button" disabled={busy || pending || resendSeconds > 0} onClick={() => void issueCode()}>{resendSeconds > 0 ? "Resend available in " + formatOtpCountdown(resendSeconds) : "Resend code"}</button>
        <button type="button" disabled={pending} onClick={changeEmail}>Change email</button>
      </div>
    </form>}
    {!challenge && <div className={styles.actions}>
      {mode !== "email" && <button type="button" onClick={() => chooseMode("email")} disabled={busy || pending}>Email code sign-in</button>}
      {mode !== "login" && <button type="button" onClick={() => chooseMode("login")} disabled={busy || pending}>Account sign-in</button>}
      {mode !== "register" && <button type="button" onClick={() => chooseMode("register")} disabled={busy || pending}>Create account</button>}
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
