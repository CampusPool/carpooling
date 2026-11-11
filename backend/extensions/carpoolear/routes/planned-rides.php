<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Commute\PlannedRidesController;

Route::prefix('api/mobility/address-rides')->middleware(['api', 'logged'])->group(function (): void {
    Route::get('plan', [PlannedRidesController::class, 'show']);
    Route::put('plan', [PlannedRidesController::class, 'save']);
});
