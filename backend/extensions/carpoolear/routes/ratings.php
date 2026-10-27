<?php
use Illuminate\Support\Facades\Route;
use STS\Mobility\Rating\TripRatingController as C;
Route::prefix('api/mobility')->middleware(['api', 'logged'])->group(function (): void {
 Route::get('trips/{trip}/ratings', [C::class, 'index'])->whereNumber('trip');
 Route::post('trips/{trip}/ratings', [C::class, 'store'])->middleware('throttle:mobility-rating-create')->whereNumber('trip');
});
