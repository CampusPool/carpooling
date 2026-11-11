<?php

namespace STS\Mobility\Commute;

use Illuminate\Http\JsonResponse;
use STS\Models\Passenger;

/** Response privacy for student address journeys before a booking is accepted. */
final class AddressRidePresenter
{
    public static function response(JsonResponse $response, string $kind): JsonResponse
    {
        $payload = $response->getData(true);
        unset($payload['demo'], $payload['demo_only']);
        if ($kind === 'rides') {
            $payload['data'] = array_map(self::card(...), $payload['data'] ?? []);
            if (isset($payload['ranking']['basis'])) {
                $payload['ranking']['basis'] = array_map(fn ($value) => $value === 'demo_fare' ? 'estimated_fare' : $value, $payload['ranking']['basis']);
            }
        } elseif ($kind === 'bookings') {
            $payload['data'] = array_map(self::booking(...), $payload['data'] ?? []);
        } elseif ($kind === 'booking' && isset($payload['data'])) {
            $payload['data'] = self::booking($payload['data']);
        } elseif ($kind === 'notification' && isset($payload['data'])) {
            $payload['data'] = self::notification($payload['data']);
        } elseif ($kind === 'notifications') {
            $payload['data'] = array_map(self::notification(...), $payload['data'] ?? []);
        }
        return $response->setData($payload)->header('Cache-Control', 'private, no-store, max-age=0');
    }

    private static function card(array $card): array
    {
        unset($card['demo_fixture'], $card['route_map'], $card['driver_route_origin_label'], $card['driver_route_destination_label']);
        if (isset($card['driver_name'])) $card['driver_name'] = self::firstName($card['driver_name']);
        $card['ranking_reasons'] = array_map(fn ($reason) => str_replace(' demo fare', ' estimated fare', $reason), $card['ranking_reasons'] ?? []);
        $card['ranking_basis'] = array_map(fn ($basis) => $basis === 'demo_fare' ? 'estimated_fare' : $basis, $card['ranking_basis'] ?? []);
        return $card;
    }

    private static function booking(array $booking): array
    {
        unset($booking['demo_fixture'], $booking['wallet_state'], $booking['receipt'], $booking['release_at'], $booking['rider_arrived_at']);
        if ((int) ($booking['request_state'] ?? -1) !== Passenger::STATE_ACCEPTED) {
            unset($booking['route_map'], $booking['driver_route_origin_label'], $booking['driver_route_destination_label'], $booking['meeting_details']);
            $booking['pickup_label'] = 'Pickup details shared after acceptance';
            $booking['dropoff_label'] = 'Destination details shared after acceptance';
        }
        return $booking;
    }

    private static function notification(array $notification): array
    {
        $state = Passenger::whereKey($notification['booking_id'])->value('request_state');
        if ((int) $state !== Passenger::STATE_ACCEPTED) {
            unset($notification['pickup_label'], $notification['dropoff_label']);
            $notification['body'] = match ($notification['kind']) {
                'booking_requested' => 'A rider requested a seat on your ride.',
                'booking_rejected' => 'The booking request was declined.',
                'booking_cancelled' => 'The booking was cancelled.',
                default => 'Your booking was updated.',
            };
        }
        return $notification;
    }

    private static function firstName(string $name): string
    {
        return preg_split('/\s+/u', trim($name), 2)[0] ?: 'Driver';
    }
}
