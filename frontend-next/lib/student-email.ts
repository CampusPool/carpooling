/** Browser guidance only. Laravel independently validates the student domain. */
export function normalizeStudentEmail(value: string): string | null {
  const raw = value.trim().toLowerCase();
  // A PES UG SRN is a shorthand for its own @stu.pes.edu mailbox.
  const email = /^pes[0-9]ug[0-9]{2}[a-z]{2,4}[0-9]{3,4}$/.test(raw)
    ? raw + "@stu.pes.edu"
    : raw;
  const [local, domain, extra] = email.split("@");
  if (extra !== undefined || domain !== "stu.pes.edu" || !local || local.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9._%-]*$/.test(local) || local.includes("..") || local.endsWith(".")) return null;
  return email;
}
export function formatOtpCountdown(seconds: number): string {
  const time = Math.max(0, Math.ceil(seconds));
  return Math.floor(time / 60) + ":" + String(time % 60).padStart(2, "0");
}
