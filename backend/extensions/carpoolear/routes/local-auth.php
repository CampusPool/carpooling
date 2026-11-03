<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Identity\LocalAccountAuthController;

Route::prefix('api/mobility/local-auth')->middleware(['api', 'throttle:10,1'])->group(function (): void {
    Route::get('config', [LocalAccountAuthController::class, 'config']);
    Route::post('register', [LocalAccountAuthController::class, 'register']);
    Route::post('login', [LocalAccountAuthController::class, 'login']);
});
