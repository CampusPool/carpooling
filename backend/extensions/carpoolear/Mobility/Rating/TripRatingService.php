<?php
namespace STS\Mobility\Rating;
use Illuminate\Support\Facades\DB;
use STS\Models\{Passenger, Trip, User};

final class TripRatingService {
 public function create(Trip $trip, User $rater, int $rating, ?string $comment, int $rateeId, string $idempotencyKey): array {
  return DB::transaction(function () use ($trip, $rater, $rating, $comment, $rateeId, $idempotencyKey): array {
   $locked = Trip::query()->whereKey($trip->id)->lockForUpdate()->first();
   if (!$locked) throw new TripRatingException('TRIP_NOT_FOUND', 404);
   $participants = $this->participants($locked);
   if (!$this->canRate($participants, (int) $rater->id, $rateeId)) throw new TripRatingException('TRIP_RATING_FORBIDDEN', 403);
   if (DB::table('mobility_trip_lifecycles')->where('trip_id', $locked->id)->value('state') !== 'completed') throw new TripRatingException('TRIP_NOT_COMPLETED', 409);
   $comment = $comment === '' ? null : $comment;
   $hash = hash('sha256', json_encode(['ratee_id' => $rateeId, 'rating' => $rating, 'comment' => $comment], JSON_THROW_ON_ERROR));
   $existing = DB::table('mobility_trip_ratings')->where(['trip_id' => $locked->id, 'rater_id' => $rater->id, 'idempotency_key' => $idempotencyKey])->first();
   if ($existing) {
    if (!hash_equals((string) $existing->request_hash, $hash)) throw new TripRatingException('IDEMPOTENCY_CONFLICT', 409);
    return $this->projection($existing, (int) $rater->id) + ['_replayed' => true];
   }
   if (DB::table('mobility_trip_ratings')->where(['trip_id' => $locked->id, 'rater_id' => $rater->id, 'ratee_id' => $rateeId])->exists()) throw new TripRatingException('TRIP_RATING_ALREADY_EXISTS', 409);
   $id = DB::table('mobility_trip_ratings')->insertGetId(['trip_id' => $locked->id, 'rater_id' => $rater->id, 'ratee_id' => $rateeId, 'rating' => $rating, 'comment' => $comment, 'idempotency_key' => $idempotencyKey, 'request_hash' => $hash, 'created_at' => now(), 'updated_at' => now()]);
   return $this->projection(DB::table('mobility_trip_ratings')->where('id', $id)->first(), (int) $rater->id) + ['_replayed' => false];
  });
 }
 public function list(Trip $trip, User $actor): array {
  $participants = $this->participants($trip);
  if (!in_array((int) $actor->id, $participants, true)) throw new TripRatingException('TRIP_RATING_FORBIDDEN', 403);
  if (DB::table('mobility_trip_lifecycles')->where('trip_id', $trip->id)->value('state') !== 'completed') throw new TripRatingException('TRIP_NOT_COMPLETED', 409);
  $ratings = DB::table('mobility_trip_ratings as mine')
   ->where('mine.trip_id', $trip->id)
   ->where(function ($query) use ($actor): void {
    $query->where('mine.rater_id', $actor->id)
     ->orWhere(function ($received) use ($actor): void {
      $received->where('mine.ratee_id', $actor->id)
       ->whereExists(function ($mutual) use ($actor): void {
        $mutual->select(DB::raw('1'))
         ->from('mobility_trip_ratings as reply')
         ->whereColumn('reply.trip_id', 'mine.trip_id')
         ->whereColumn('reply.rater_id', 'mine.ratee_id')
         ->whereColumn('reply.ratee_id', 'mine.rater_id');
       });
     });
   })
   ->orderBy('mine.id')
   ->get(['mine.*']);
  return ['data' => $ratings->map(fn ($r) => $this->projection($r, (int) $actor->id))->all()];
 }
 private function participants(Trip $trip): array { return array_merge([(int) $trip->user_id], Passenger::query()->where('trip_id', $trip->id)->where('passenger_type', Passenger::TYPE_PASAJERO)->where('request_state', Passenger::STATE_ACCEPTED)->pluck('user_id')->map(fn ($id) => (int) $id)->all()); }
 private function canRate(array $participants, int $raterId, int $rateeId): bool { return in_array($raterId, $participants, true) && in_array($rateeId, $participants, true) && $rateeId !== $raterId; }
 private function projection(object $row, ?int $actorId = null): array {
  $result = ['id' => (int) $row->id, 'trip_id' => (int) $row->trip_id, 'rating' => (int) $row->rating, 'comment' => $row->comment, 'created_at' => $row->created_at];
  if ($actorId !== null) {
   $authored = (int) $row->rater_id === $actorId;
   $result['direction'] = $authored ? 'authored' : 'received';
   $result['counterpart_id'] = $authored ? (int) $row->ratee_id : (int) $row->rater_id;
  }
  return $result;
 }
}
