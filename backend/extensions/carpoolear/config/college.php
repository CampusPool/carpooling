<?php

return [
    'domains' => ['stu.pes.edu'],
    'code' => env('MOBILITY_COLLEGE_CODE', 'CAMPUS-BLR'),
    'campuses' => array_values(array_filter(array_map('trim', explode(',', (string) env('MOBILITY_CAMPUS_CODES', 'CAMPUS-BLR'))))),
    // Keep the default at five minutes; override only in isolated tests.
    'otp_ttl' => app()->environment('testing') ? (int) env('MOBILITY_COLLEGE_TEST_OTP_TTL', 300) : 300,
    'otp_resend_after' => 60,
    'otp_max_attempts' => 5,
];
