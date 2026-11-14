"use client";

import { useEffect, useState, type FormEvent } from "react";
import { request } from "../lib/legacy-api";
import styles from "./StudentSignIn.module.css";

export type StudentProfileDetails = {
  name: string;
  email: string;
  srn: string;
  campus_code: string;
  gender_identity: string | null;
  phone: string | null;
  complete: boolean;
};

export const genderOptions = [
  ["woman", "Woman"], ["man", "Man"], ["non_binary", "Non-binary"],
  ["self_described", "Another identity"], ["prefer_not_to_say", "Prefer not to say"],
];

export default function StudentProfile({ token, onSaved }: {
  token: string; onSaved: (profile: StudentProfileDetails) => void;
}) {
  const [profile, setProfile] = useState<StudentProfileDetails>();
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    request("college-auth/profile", token).then(data => {
      if (!active) return;
      setProfile(data);
      setName(data.name);
      setGender(data.gender_identity || "");
      setPhone(data.phone || "");
    }).catch((error: Error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [token]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await request("college-auth/profile", token, "PUT", { name, gender_identity: gender, phone });
      setProfile(updated);
      setName(updated.name);
      setGender(updated.gender_identity);
      setPhone(updated.phone);
      onSaved(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return error ? <p className="error" role="alert">{error}</p> : <p role="status">Loading your profile…</p>;

  return <section className={styles.profilePanel}>
    <dl>
      <div><dt>Verified email</dt><dd>{profile.email}</dd></div>
      <div><dt>Student registration number</dt><dd>{profile.srn}</dd></div>
      <div><dt>Campus</dt><dd>{profile.campus_code === "CAMPUS-BLR" ? "Bengaluru" : profile.campus_code}</dd></div>

    </dl>
    <form className={styles.form} onSubmit={save}>
      <label>Full name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>
      <label>Gender<select value={gender} onChange={event => setGender(event.target.value)} required>
        <option value="">Select gender</option>{genderOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Phone number<input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" type="tel" placeholder="+91" maxLength={30} required /></label>
      <button type="submit" className={styles.submit} disabled={saving}>{saving ? "Saving…" : profile.complete ? "Save changes" : "Save and continue"}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
