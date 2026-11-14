<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Safety\StudentSafetyController;

Route::prefix('api/mobility')->middleware(['api', 'logged'])->group(function (): void {
    Route::get('trusted-contact', [StudentSafetyController::class, 'contact']);
    Route::put('trusted-contact', [StudentSafetyController::class, 'saveContact']);
    Route::get('trips/{trip}/safety-check', [StudentSafetyController::class, 'latest'])->whereNumber('trip');
    Route::post('trips/{trip}/safety-check', [StudentSafetyController::class, 'check'])->whereNumber('trip');
});
