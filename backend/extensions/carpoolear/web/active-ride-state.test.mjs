import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { currentBookingCandidates, isCurrentBooking, isExpiredPlannedBooking, rideDate, rideTimestamp, selectCurrentBooking } from './active-ride-state.mjs';

const now = Date.parse('2026-10-27T10:00:00Z');
const booking = (overrides = {}) => ({ request_state: 1, state: 'planned', departure_at: '2026-10-27T16:00:00+05:30', ...overrides });

test('the imported helper is exposed by the commute asset route', async () => {
  const route = await readFile(new URL('../routes/commute.php', import.meta.url), 'utf8');
  assert.match(route, /'active-ride-state\.mjs'=>'active-ride-state\.mjs'/);
});

test('parses timezone-less database timestamps as IST', () => {
  assert.equal(rideTimestamp('2026-10-27 15:30:00'), Date.parse('2026-10-27T15:30:00+05:30'));
  assert.equal(rideTimestamp('2026-10-27T15:30:00Z'), Date.parse('2026-10-27T15:30:00Z'));
  assert.equal(rideTimestamp('not-a-date'), null);
  assert.equal(rideDate('2026-10-26T19:00:00Z'), '2026-10-27');
  assert.equal(rideDate('not-a-date'), null);
});

test('excludes past and malformed planned requests but keeps in-progress rides', () => {
  assert.equal(isCurrentBooking(booking({ departure_at: '2026-10-23T10:00:00+05:30' }), now), false);
  assert.equal(isCurrentBooking(booking({ departure_at: 'malformed' }), now), false);
  assert.equal(isCurrentBooking(booking({ state: 'in_progress', departure_at: 'malformed' }), now), true);
  assert.equal(isCurrentBooking(booking({ request_state: 2 }), now), false);
  assert.equal(isCurrentBooking(booking(), now), true);
});

test('marks only active planned bookings with a past departure as expired', () => {
  assert.equal(isExpiredPlannedBooking(booking({ departure_at: '2026-10-23T10:00:00+05:30' }), now), true);
  assert.equal(isExpiredPlannedBooking(booking(), now), false);
  assert.equal(isExpiredPlannedBooking(booking({ state: 'in_progress', departure_at: '2026-10-23T10:00:00+05:30' }), now), false);
  assert.equal(isExpiredPlannedBooking(booking({ request_state: 2, departure_at: '2026-10-23T10:00:00+05:30' }), now), false);
  assert.equal(isExpiredPlannedBooking(booking({ departure_at: 'invalid' }), now), false);
});

test('selects a live ride before future or historical planned rides', () => {
  const live = booking({ state: 'in_progress', departure_at: '2026-10-23T10:00:00+05:30' });
  const futureToday = booking({ departure_at: '2026-10-27T18:00:00+05:30' });
  const historical = booking({ departure_at: '2026-10-23T10:00:00+05:30' });
  assert.equal(selectCurrentBooking([historical, futureToday, live], '2026-10-27', now), live);
  assert.deepEqual(currentBookingCandidates([historical, futureToday, live], now), [futureToday, live]);
});

test('prefers the selected date and soonest departure when no ride is in progress', () => {
  const tomorrow = booking({ departure_at: '2026-10-28T08:00:00+05:30' });
  const today = booking({ departure_at: '2026-10-27T18:00:00+05:30' });
  assert.equal(selectCurrentBooking([tomorrow, today], '2026-10-27', now), today);
  assert.equal(selectCurrentBooking([tomorrow], '2026-10-27', now), tomorrow);
});
