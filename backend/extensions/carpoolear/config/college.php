<?php

return [
    'domains' => ['stu.pes.edu'],
    'code' => env('MOBILITY_COLLEGE_CODE', 'CAMPUS-BLR'),
    'campuses' => array_values(array_filter(array_map('trim', explode(',', (string) env('MOBILITY_CAMPUS_CODES', 'CAMPUS-BLR'))))),
    'otp_ttl' => 300,
    'otp_resend_after' => 30,
    'otp_max_attempts' => 5,
];
