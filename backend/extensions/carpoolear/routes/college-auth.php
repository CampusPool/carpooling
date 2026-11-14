<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Identity\CollegeEmailAuthController;

Route::prefix('api/mobility/college-auth')->middleware('api')->group(function (): void {
    Route::get('config', [CollegeEmailAuthController::class, 'config']);
    Route::post('request', [CollegeEmailAuthController::class, 'requestCode']);
    Route::post('verify', [CollegeEmailAuthController::class, 'verify']);
    Route::post('password-login', [CollegeEmailAuthController::class, 'passwordLogin']);
    Route::get('profile', [CollegeEmailAuthController::class, 'studentProfile'])->middleware('auth:api');
    Route::put('profile', [CollegeEmailAuthController::class, 'updateStudentProfile'])->middleware('auth:api');
    Route::post('session', [CollegeEmailAuthController::class, 'rememberBrowser'])->middleware('auth:api');
    Route::get('session', [CollegeEmailAuthController::class, 'restoreBrowser']);
    Route::delete('session', [CollegeEmailAuthController::class, 'forgetBrowser']);
    Route::post('logout', [CollegeEmailAuthController::class, 'logout'])->middleware('auth:api');
});
