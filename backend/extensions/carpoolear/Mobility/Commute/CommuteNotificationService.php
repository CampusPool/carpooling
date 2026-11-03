<?php
namespace STS\Mobility\Commute;

use Illuminate\Support\Facades\DB;
use Carbon\CarbonImmutable;
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
  $booking=Passenger::find($row->booking_id);$trip=Trip::find($row->trip_id);
  $context=[];
  if($booking&&$trip){
   $terms=app(CommuteMatchingService::class)->terms($booking);
   $journey=$terms?json_decode($terms->journey,true):[];
   $departure=$terms?->pickup_at??$trip->trip_date;
   $context=['rider_name'=>User::whereKey($booking->user_id)->value('name'),'driver_name'=>User::whereKey($trip->user_id)->value('name'),'pickup_label'=>$journey['rider_origin']['label']??$trip->from_town,'dropoff_label'=>$journey['rider_destination']['label']??$trip->to_town,'departure_at'=>CarbonImmutable::parse($departure,'Asia/Kolkata')->toISOString()];
   if($row->kind==='booking_requested')$copy['body']=sprintf('%s requested a seat from %s to %s at %s.',$context['rider_name'],$context['pickup_label'],$context['dropoff_label'],CarbonImmutable::parse($departure,'Asia/Kolkata')->format('d M, h:i A'));
   if($row->kind==='booking_accepted')$copy['body']=sprintf('%s accepted your seat from %s at %s.',$context['driver_name'],$context['pickup_label'],CarbonImmutable::parse($departure,'Asia/Kolkata')->format('d M, h:i A'));
  }
  return array_merge(['id' => (int) $row->id, 'kind' => $row->kind, 'booking_id' => (int) $row->booking_id, 'trip_id' => (int) $row->trip_id, 'title' => $copy['title'], 'body' => $copy['body'], 'read_at' => $row->read_at, 'created_at' => $row->created_at],$context);
 }
}
