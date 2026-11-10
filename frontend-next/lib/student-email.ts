/** Browser guidance only. Laravel independently validates the student domain. */
export function normalizeStudentEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const [local, domain, extra] = email.split("@");
  if (extra !== undefined || domain !== "stu.pes.edu" || !local || local.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9._%-]*$/.test(local) || local.includes("..") || local.endsWith(".")) return null;
  return email;
}
export function formatOtpCountdown(seconds: number): string {
  const time = Math.max(0, Math.ceil(seconds));
  return Math.floor(time / 60) + ":" + String(time % 60).padStart(2, "0");
}
