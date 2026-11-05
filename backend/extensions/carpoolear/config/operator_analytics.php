<?php

return [
    // Only the authenticated Laravel operator endpoint is browser-accessible.
    'url' => env('MOBILITY_ACTIVITY_SERVICE_URL'),
    'key' => env('MOBILITY_ACTIVITY_SERVICE_KEY'),
];
