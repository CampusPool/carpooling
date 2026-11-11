<?php

namespace STS\Mobility\Commute;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PesTimetableController
{
    public function show(Request $request): JsonResponse
    {
        $saved = DB::table('mobility_pes_timetables')->where('user_id', $request->user()->id)->value('entries');

        return $this->reply(['data' => $saved === null ? [] : json_decode($saved, true, 512, JSON_THROW_ON_ERROR)]);
    }

    public function save(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entries' => 'required|array|min:1|max:300',
            'entries.*' => 'required|array:day,dayName,slot,option,start,end,title',
            'entries.*.day' => 'required|integer|between:1,7',
            'entries.*.dayName' => 'required|string|max:20',
            'entries.*.slot' => 'required|integer|between:1,100',
            'entries.*.option' => 'required|integer|between:1,100',
            'entries.*.start' => 'required|date_format:H:i',
            'entries.*.end' => 'required|date_format:H:i',
            'entries.*.title' => 'required|string|max:300',
        ]);
        $entries = array_values($validated['entries']);
        $seen = [];
        foreach ($entries as $entry) {
            $key = $entry['day'].':'.$entry['slot'].':'.$entry['option'];
            if ($entry['start'] >= $entry['end'] || isset($seen[$key])) {
                throw ValidationException::withMessages(['entries' => 'Invalid timetable.']);
            }
            $seen[$key] = true;
        }

        $now = now();
        DB::table('mobility_pes_timetables')->upsert([[
            'user_id' => $request->user()->id,
            'entries' => json_encode($entries, JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['user_id'], ['entries', 'updated_at']);

        return $this->reply(['saved' => true, 'count' => count($entries)]);
    }

    public function destroy(Request $request): JsonResponse
    {
        DB::table('mobility_pes_timetables')->where('user_id', $request->user()->id)->delete();

        return $this->reply(['deleted' => true]);
    }

    private function reply(array $body): JsonResponse
    {
        return response()->json($body)->header('Cache-Control', 'no-store');
    }
}
