<?php

use Illuminate\Support\Facades\Route;
use STS\Mobility\Commute\AddressRideController;

Route::prefix('api/mobility/address-rides')->middleware(['api', 'logged'])->group(function (): void {
    Route::get('vehicles', [AddressRideController::class, 'vehicles']);
    Route::post('vehicles/lookup', [AddressRideController::class, 'lookupVehicle']);
    Route::post('vehicles', [AddressRideController::class, 'saveVehicle']);
    Route::get('me', [AddressRideController::class, 'me']);
    Route::put('profile', [AddressRideController::class, 'profile']);
    Route::get('rides', [AddressRideController::class, 'rides']);
    Route::get('offers', [AddressRideController::class, 'offers']);
    Route::post('offers', [AddressRideController::class, 'publish']);
    Route::post('rides/{trip}/request', [AddressRideController::class, 'request'])->whereNumber('trip');
    Route::get('wallet', [AddressRideController::class, 'wallet']);
    Route::post('wallet/{action}', [AddressRideController::class, 'walletAction'])->whereIn('action', ['topup', 'release']);
    Route::post('bookings/{booking}/{action}', [AddressRideController::class, 'bookingPayment'])
        ->whereNumber('booking')->whereIn('action', ['pay', 'arrive', 'confirm-payment-received']);
    Route::get('bookings', [AddressRideController::class, 'bookings']);
    Route::post('bookings/{booking}/{action}', [AddressRideController::class, 'action'])->whereNumber('booking')->whereIn('action', ['accept', 'reject', 'cancel']);
    Route::post('notifications/{notification}/read', [AddressRideController::class, 'readNotification'])->whereNumber('notification');
    Route::get('notifications', [AddressRideController::class, 'notifications']);
    Route::post('trips/{trip}/transition', [AddressRideController::class, 'transition'])->whereNumber('trip');
});
