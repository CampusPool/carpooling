<?php

namespace STS\Mobility\Identity;

use Illuminate\Support\Facades\DB;
use STS\Models\User;

final class StudentProfile
{
    public static function details(array $input, bool $required): array
    {
        $gender = $input['gender_identity'] ?? null;
        if (($required || $gender !== null) && !in_array($gender, ['woman', 'man', 'non_binary', 'self_described', 'prefer_not_to_say'], true)) {
            throw new CollegeEmailAuthException('STUDENT_GENDER_INVALID', 422);
        }
        $rawPhone = $input['phone'] ?? null;
        $phone = is_string($rawPhone) ? preg_replace('/[\s()-]/', '', trim($rawPhone)) : null;
        if ($phone && preg_match('/^[6-9][0-9]{9}$/D', $phone)) {
            $phone = '+91'.$phone;
        }
        if (($required || $rawPhone !== null) && (!$phone || !preg_match('/^\+[1-9][0-9]{7,14}$/D', $phone))) {
            throw new CollegeEmailAuthException('STUDENT_PHONE_INVALID', 422);
        }
        return ['gender_identity' => $gender, 'phone_e164' => $phone];
    }

    public function read(User $user): array
    {
        $row = DB::table('mobility_student_profiles')->where('user_id', $user->id)->first();
        if (!$row) throw new CollegeEmailAuthException('STUDENT_PROFILE_NOT_FOUND', 404);
        return [
            'name' => $user->name, 'email' => $user->email, 'srn' => $row->srn_normalized,
            'campus_code' => $row->campus_code, 'gender_identity' => $row->gender_identity,
            'phone' => $row->phone_e164,
            'complete' => $row->gender_identity !== null && $row->phone_e164 !== null,
        ];
    }

    public function update(User $user, array $input): array
    {
        $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120 || preg_match('/[<>\x00-\x1F]/u', $name)) {
            throw new CollegeEmailAuthException('STUDENT_NAME_INVALID', 422);
        }
        $details = self::details($input, true);
        return DB::transaction(function () use ($user, $name, $details): array {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $this->read($locked);
            $locked->name = $name;
            $locked->save();
            DB::table('mobility_student_profiles')->where('user_id', $locked->id)->update($details + ['updated_at' => now()]);
            return $this->read($locked);
        });
    }
}
