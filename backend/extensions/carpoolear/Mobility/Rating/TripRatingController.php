<?php
namespace STS\Mobility\Rating;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use STS\Models\Trip;

final class TripRatingController {
 public function store(Request $request, Trip $trip, TripRatingService $service) {
  try { $v = $request->validate(['ratee_id' => 'required|integer|min:1', 'rating' => 'required|integer|between:1,5', 'comment' => 'sometimes|nullable|string|max:1000']); }
  catch (ValidationException $e) { return response()->json(['message' => 'The given data was invalid.', 'errors' => $e->errors()], 422)->header('Cache-Control', 'private, no-store, max-age=0'); }
  $key = trim((string) $request->header('Idempotency-Key', ''));
  if ($key === '' || strlen($key) > 100) return response()->json(['error' => ['code' => 'IDEMPOTENCY_KEY_REQUIRED']], 422)->header('Cache-Control', 'private, no-store, max-age=0');
  try { $data = $service->create($trip, $request->user(), (int) $v['rating'], isset($v['comment']) ? trim((string) $v['comment']) : null, (int) $v['ratee_id'], $key); $replayed = (bool) ($data['_replayed'] ?? false); unset($data['_replayed']); return response()->json(['data' => $data], $replayed ? 200 : 201)->header('Cache-Control', 'private, no-store, max-age=0'); }
  catch (TripRatingException $e) { return response()->json(['error' => ['code' => $e->errorCode]], $e->httpStatus)->header('Cache-Control', 'private, no-store, max-age=0'); }
 }
 public function index(Request $request, Trip $trip, TripRatingService $service) {
  try { return response()->json($service->list($trip, $request->user()))->header('Cache-Control', 'private, no-store, max-age=0'); }
  catch (TripRatingException $e) { return response()->json(['error' => ['code' => $e->errorCode]], $e->httpStatus)->header('Cache-Control', 'private, no-store, max-age=0'); }
 }
}
