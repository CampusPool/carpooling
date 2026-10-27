<?php
namespace STS\Mobility\Commute;

use Illuminate\Support\Facades\DB;
use STS\Models\{Passenger, Trip, User};

/** Durable, private in-app booking events. This intentionally has no mail/push side effect. */
final class CommuteNotificationService {
 private const KINDS = ['booking_requested', 'booking_accepted', 'booking_rejected', 'booking_cancelled'];

 public function bookingRequested(Passenger $booking, Trip $trip): void {
  $this->record((int) $trip->user_id, $booking, 'booking_requested');
 }

 public function bookingAction(Passenger $booking, Trip $trip, string $kind, User $actor): void {
  if (!in_array($kind, ['booking_accepted', 'booking_rejected', 'booking_cancelled'], true)) return;
  $recipient = (int) $actor->id === (int) $trip->user_id ? (int) $booking->user_id : (int) $trip->user_id;
  $this->record($recipient, $booking, $kind);
 }

 public function list(User $actor): array {
  $rows = DB::table('mobility_commute_booking_notifications')
   ->where('user_id', $actor->id)->orderByDesc('id')->limit(50)->get();
  return [
   'data' => $rows->map(fn ($row) => $this->dto($row))->all(),
   'unread_count' => (int) DB::table('mobility_commute_booking_notifications')->where('user_id', $actor->id)->whereNull('read_at')->count(),
   'demo_only' => true,
  ];
 }

 public function read(User $actor, int $id): array {
  DB::table('mobility_commute_booking_notifications')->where('id', $id)->where('user_id', $actor->id)->whereNull('read_at')->update(['read_at' => now(), 'updated_at' => now()]);
  $row = DB::table('mobility_commute_booking_notifications')->where('id', $id)->where('user_id', $actor->id)->first();
  if (!$row) abort(404);
  return ['data' => $this->dto($row), 'demo_only' => true];
 }

 private function record(int $userId, Passenger $booking, string $kind): void {
  if (!in_array($kind, self::KINDS, true)) return;
  DB::table('mobility_commute_booking_notifications')->insertOrIgnore([
   'user_id' => $userId, 'booking_id' => $booking->id, 'trip_id' => $booking->trip_id,
   'kind' => $kind, 'dedupe_key' => $kind.':'.$booking->id,
   'created_at' => now(), 'updated_at' => now(),
  ]);
 }

 private function dto(object $row): array {
  $copy = [
   'booking_requested' => ['title' => 'New booking request', 'body' => 'A rider requested a seat on your trip.'],
   'booking_accepted' => ['title' => 'Booking accepted', 'body' => 'Your booking request was accepted.'],
   'booking_rejected' => ['title' => 'Booking declined', 'body' => 'Your booking request was declined.'],
   'booking_cancelled' => ['title' => 'Booking cancelled', 'body' => 'A booking on your trip was cancelled.'],
  ][$row->kind] ?? ['title' => 'Booking update', 'body' => 'Your booking was updated.'];
  return ['id' => (int) $row->id, 'kind' => $row->kind, 'booking_id' => (int) $row->booking_id, 'trip_id' => (int) $row->trip_id, 'title' => $copy['title'], 'body' => $copy['body'], 'read_at' => $row->read_at, 'created_at' => $row->created_at];
 }
}
