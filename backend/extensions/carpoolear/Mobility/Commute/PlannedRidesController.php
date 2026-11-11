<?php

namespace STS\Mobility\Commute;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PlannedRidesController
{
    public function show(Request $request): JsonResponse
    {
        $userId = $this->studentId($request);
        $stored = DB::table('mobility_student_ride_plans')->where('user_id', $userId)->value('schedule');

        return $this->reply($stored === null ? null : json_decode($stored, true, 512, JSON_THROW_ON_ERROR));
    }

    public function save(Request $request): JsonResponse
    {
        $userId = $this->studentId($request);
        $plan = $request->validate([
            'home' => 'required|array:label,lat,lng',
            'campus' => 'required|array:label,lat,lng',
            'home.label' => 'required|string|max:160',
            'campus.label' => 'required|string|max:160',
            'home.lat' => 'required|numeric|between:12.65,13.35',
            'campus.lat' => 'required|numeric|between:12.65,13.35',
            'home.lng' => 'required|numeric|between:77.2,77.95',
            'campus.lng' => 'required|numeric|between:77.2,77.95',
            'outbound_time' => 'required|date_format:H:i',
            'return_time' => 'required|date_format:H:i',
            'weekdays' => 'required|array|min:1|max:7',
            'weekdays.*' => 'required|integer|distinct|between:1,7',
            'paused' => 'required|boolean',
            'outbound_enabled' => 'required|boolean',
            'return_enabled' => 'required|boolean',
        ]);

        foreach (['home', 'campus'] as $field) {
            $plan[$field]['lat'] = (float) $plan[$field]['lat'];
            $plan[$field]['lng'] = (float) $plan[$field]['lng'];
        }
        if ($plan['home']['lat'] === $plan['campus']['lat'] && $plan['home']['lng'] === $plan['campus']['lng']) {
            throw ValidationException::withMessages(['campus' => 'Choose a campus address different from home.']);
        }
        $plan['weekdays'] = array_map('intval', array_values($plan['weekdays']));
        sort($plan['weekdays']);
        foreach (['paused', 'outbound_enabled', 'return_enabled'] as $field) {
            $plan[$field] = (bool) $plan[$field];
        }
        if (!$plan['paused'] && !$plan['outbound_enabled'] && !$plan['return_enabled']) {
            throw ValidationException::withMessages(['outbound_enabled' => 'Enable at least one direction or pause the schedule.']);
        }

        $now = now();
        DB::table('mobility_student_ride_plans')->upsert([[
            'user_id' => $userId,
            'schedule' => json_encode($plan, JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['user_id'], ['schedule', 'updated_at']);

        return $this->reply($plan);
    }

    private function studentId(Request $request): int
    {
        $student = $request->user();
        abort_unless($student && AddressRideContext::eligible($student), 403, 'Verified student access required.');

        return (int) $student->id;
    }

    private function reply(?array $plan): JsonResponse
    {
        return response()->json(['data' => $plan])->header('Cache-Control', 'private, no-store');
    }
}
