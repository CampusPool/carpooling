/** All local commute form dates and times are interpreted in Asia/Kolkata. */
export function istDateTime(instant: Date): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function isFutureCommute(date: string, time: string, now = Date.now(), minimumLeadMinutes = 15): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const minimum = istDateTime(new Date(now + minimumLeadMinutes * 60000));
  return `${date}T${time}` > `${minimum.date}T${minimum.time}`;
}

/** Respect a stored daily commute time, but move today's expired trip to tomorrow. */
export function initialCommuteSchedule(savedTime: unknown, now = Date.now()) {
  const suggested = istDateTime(new Date(now + 30 * 60000));
  const saved = String(savedTime || "").slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(saved)) return suggested;
  const today = istDateTime(new Date(now)).date;
  if (isFutureCommute(today, saved, now)) return { date: today, time: saved };
  // The next local calendar day, including month and year boundaries.
  const tomorrow = istDateTime(new Date(now + 24 * 60 * 60000)).date;
  return { date: tomorrow, time: saved };
}
