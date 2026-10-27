<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Tracking\TrackingController;
use STS\Mobility\Tracking\TrustedShareController;

Route::prefix('api')->middleware(['api', 'logged'])->group(function (): void {
    Route::post('mobility/trips/{trip}/tracking/session', [TrackingController::class, 'session'])->whereNumber('trip');
    Route::post('mobility/trips/{trip}/tracking/locations', [TrackingController::class, 'location'])->whereNumber('trip');
    Route::get('mobility/trips/{trip}/tracking', [TrackingController::class, 'show'])->whereNumber('trip');
    Route::post('mobility/trips/{trip}/tracking/stop', [TrackingController::class, 'stop'])->whereNumber('trip');
    Route::post('mobility/trips/{trip}/trusted-shares', [TrustedShareController::class, 'create'])->middleware('throttle:mobility-trusted-share-create')->whereNumber('trip');
    Route::delete('mobility/trips/{trip}/trusted-shares/{grant}', [TrustedShareController::class, 'revoke'])->middleware('throttle:mobility-trusted-share-revoke')->whereNumber('trip')->whereNumber('grant');
});

Route::prefix('api')->middleware(['api', 'throttle:mobility-trusted-share-read'])->get('mobility/trusted-shares/{token}', [TrustedShareController::class, 'read']);
