<?php

namespace STS\Mobility\Safety;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use STS\Mobility\Identity\CollegeEmailAuth;
use STS\Mobility\Identity\CollegeEmailAuthException;
use STS\Models\Passenger;
use STS\Models\Trip;
use STS\Models\User;

final class StudentSafetyController
{
    public function contact(Request $request): JsonResponse
    {
        $email = DB::table('mobility_student_trusted_contacts')->where('user_id', $request->user()->id)->value('email');
        return $this->json(['email' => $email]);
    }

    public function saveContact(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email:rfc|max:254', 'consent_confirmed' => 'accepted']);
        $email = strtolower(trim($data['email']));
        DB::table('mobility_student_trusted_contacts')->updateOrInsert(
            ['user_id' => $request->user()->id], ['email' => $email, 'updated_at' => now(), 'created_at' => now()]
        );
        return $this->json(['email' => $email]);
    }

    public function latest(Request $request, Trip $trip): JsonResponse
    {
        if (!$this->isAcceptedRider($trip, $request->user())) return $this->error('SAFETY_RIDER_REQUIRED', 403);
        $row = DB::table('mobility_student_safety_checks')->where('trip_id', $trip->id)
            ->where('user_id', $request->user()->id)->orderByDesc('id')->first();
        return $this->json(['data' => $row ? ['safe' => (bool)$row->is_safe, 'notification_status' => $row->notification_status] : null]);
    }

    public function check(Request $request, Trip $trip, CollegeEmailAuth $mail, SafetyNotifier $notifier): JsonResponse
    {
        $rider = $request->user();
        if (!$this->isAcceptedRider($trip, $rider)) return $this->error('SAFETY_RIDER_REQUIRED', 403);
        $state = DB::table('mobility_trip_lifecycles')->where('trip_id', $trip->id)->value('state');
        if (!in_array($state, ['planned', 'in_progress', 'completed'], true)) return $this->error('SAFETY_RIDE_UNAVAILABLE', 409);
        $data = $request->validate(['safe' => 'required|boolean']);
        $safe = (bool) $data['safe'];
        $key = (string) $request->header('Idempotency-Key', '');
        if (!preg_match('/^[\x21-\x7e]{1,100}$/D', $key)) return $this->error('INVALID_IDEMPOTENCY_KEY', 422);
        $contact = DB::table('mobility_student_trusted_contacts')->where('user_id', $rider->id)->value('email');
        if (!$safe && (!$contact || !$mail->deliveryAvailable())) return $this->error($contact ? 'SAFETY_MAIL_UNAVAILABLE' : 'TRUSTED_CONTACT_REQUIRED', $contact ? 503 : 422);

        try {
            $result = DB::transaction(function () use ($rider, $trip, $safe, $key, $contact, $mail): array {
                User::query()->whereKey($rider->id)->lockForUpdate()->firstOrFail();
                $existing = DB::table('mobility_student_safety_checks')->where('user_id', $rider->id)->where('request_key', $key)->first();
                if ($existing) {
                    if ((int)$existing->trip_id !== (int)$trip->id || (bool)$existing->is_safe !== $safe) return ['error' => 'IDEMPOTENCY_CONFLICT'];
                    return ['id' => $existing->id, 'status' => $existing->notification_status, 'replay' => true];
                }
                if (!$safe) $mail->consumeRate([['safety-user:'.$rider->id, 3], ['safety-contact:'.strtolower($contact), 5]], 300);
                $status = $safe ? 'not_required' : 'sending';
                $id = DB::table('mobility_student_safety_checks')->insertGetId([
                    'user_id' => $rider->id, 'trip_id' => $trip->id, 'request_key' => $key,
                    'is_safe' => $safe, 'notification_status' => $status, 'created_at' => now(), 'updated_at' => now(),
                ]);
                return ['id' => $id, 'status' => $status, 'replay' => false];
            });
        } catch (CollegeEmailAuthException $e) {
            return $this->error($e->machineCode, $e->httpStatus);
        }
        if (isset($result['error'])) return $this->error($result['error'], 409);
        if ($result['replay']) {
            if (in_array($result['status'], ['sending', 'unknown'], true)) return $this->error('SAFETY_DELIVERY_UNCONFIRMED', 409);
            return $this->json(['data' => ['safe' => $safe, 'notification_status' => $result['status']]]);
        }
        if (!$safe) {
            try {
                $notifier->send($rider, $contact, 'safety-'.hash('sha256', $rider->id.':'.$key));
                $result['status'] = 'provider_accepted';
            } catch (\Throwable) {
                $result['status'] = 'unknown';
            }
            DB::table('mobility_student_safety_checks')->where('id', $result['id'])->update([
                'notification_status' => $result['status'], 'updated_at' => now(),
            ]);
            if ($result['status'] === 'unknown') return $this->error('SAFETY_DELIVERY_UNCONFIRMED', 503);
        }
        return $this->json(['data' => ['safe' => $safe, 'notification_status' => $result['status']]]);
    }

    private function isAcceptedRider(Trip $trip, ?User $rider): bool
    {
        return $rider && (int)$trip->user_id !== (int)$rider->id && Passenger::query()
            ->where('trip_id', $trip->id)->where('user_id', $rider->id)
            ->where('passenger_type', Passenger::TYPE_PASAJERO)->where('request_state', Passenger::STATE_ACCEPTED)->exists();
    }

    private function json(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store, max-age=0');
    }

    private function error(string $code, int $status): JsonResponse
    {
        return $this->json(['error' => ['code' => $code]])->setStatusCode($status);
    }
}
