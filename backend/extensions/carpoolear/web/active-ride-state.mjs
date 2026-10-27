const IST_OFFSET = '+05:30';
const ACTIVE_REQUEST_STATES = new Set([0, 1]);

// API timestamps are normally ISO 8601, but SQLite/MySQL-backed responses can
// also contain a timezone-less `YYYY-MM-DD HH:mm:ss`. Treat the latter as IST
// explicitly so the browser's host timezone cannot change ride eligibility.
export function rideTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const source = value.trim();
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(source);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(source)
    ? `${source}T00:00:00${IST_OFFSET}`
    : !hasTimeZone && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(source)
      ? `${source.replace(' ', 'T')}${IST_OFFSET}`
      : source;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function rideDate(value) {
  const timestamp = rideTimestamp(value);
  return timestamp === null ? null : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp));
}

export function isCurrentBooking(booking, now = Date.now()) {
  if (!booking || !ACTIVE_REQUEST_STATES.has(Number(booking.request_state))) return false;
  if (booking.state === 'in_progress') return true;
  if (booking.state !== 'planned') return false;
  const departure = rideTimestamp(booking.departure_at);
  return departure !== null && departure >= now;
}

export function isExpiredPlannedBooking(booking, now = Date.now()) {
  if (!booking || booking.state !== 'planned' || !ACTIVE_REQUEST_STATES.has(Number(booking.request_state))) return false;
  const departure = rideTimestamp(booking.departure_at);
  return departure !== null && departure < now;
}

export function currentBookingCandidates(bookings, now = Date.now()) {
  return (Array.isArray(bookings) ? bookings : []).filter(booking => isCurrentBooking(booking, now));
}

export function selectCurrentBooking(bookings, selectedDate, now = Date.now()) {
  const candidates = currentBookingCandidates(bookings, now);
  return candidates
    .map((booking, index) => {
      const day = rideDate(booking.departure_at);
      const departure = rideTimestamp(booking.departure_at);
      // An in-progress ride is the user's live journey even when its scheduled
      // departure date is historical. Otherwise prefer today's selected date,
      // then the soonest remaining planned ride.
      const priority = booking.state === 'in_progress' ? 0 : day === selectedDate ? 1 : 2;
      return { booking, index, departure: departure ?? Number.MAX_SAFE_INTEGER, priority };
    })
    .sort((left, right) => left.priority - right.priority || left.departure - right.departure || left.index - right.index)
    .at(0)?.booking || null;
}
