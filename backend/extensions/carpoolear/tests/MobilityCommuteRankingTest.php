<?php

namespace Tests\Unit\Mobility;

use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;
use STS\Mobility\Commute\CommuteMatchingService;

final class MobilityCommuteRankingTest extends TestCase
{
    public function testRankingUsesOnlyQuoteFieldsAndExplainsEachDecision(): void
    {
        $desired = CarbonImmutable::parse('2026-10-28 08:30:00', 'Asia/Kolkata');
        $cards = CommuteMatchingService::rankCards([
            ['trip_id' => 20, 'departure_at' => '2026-10-28T03:00:00.000Z', 'detour_seconds' => 0, 'access_meters' => 100, 'egress_meters' => 50, 'total_fare_minor' => 1200, 'seats_available' => 1],
            ['trip_id' => 10, 'departure_at' => '2026-10-28T03:10:00.000Z', 'detour_seconds' => 600, 'access_meters' => 20, 'egress_meters' => 20, 'total_fare_minor' => 900, 'seats_available' => 1],
        ], $desired);

        self::assertSame([20, 10], array_column($cards, 'trip_id'));
        self::assertSame([1, 2], array_column($cards, 'rank'));
        self::assertLessThan($cards[1]['ranking_score'], $cards[0]['ranking_score']);
        self::assertSame(['pickup_time_fit', 'added_detour', 'walking_distance', 'demo_fare', 'available_seats'], $cards[0]['ranking_basis']);
        self::assertStringContainsString('0 min from requested pickup', $cards[0]['ranking_reasons'][0]);
        self::assertStringContainsString('0 min added detour', $cards[0]['ranking_reasons'][1]);
    }

    public function testPriorityCannotBeOverriddenByLargeLowerPriorityValues(): void
    {
        $desired = CarbonImmutable::parse('2026-10-28 08:30:00', 'Asia/Kolkata');
        $cards = CommuteMatchingService::rankCards([
            ['trip_id' => 1, 'departure_at' => $desired->toISOString(), 'detour_seconds' => 3000, 'access_meters' => 100000, 'total_fare_minor' => 1000000],
            ['trip_id' => 2, 'departure_at' => $desired->addSecond()->toISOString(), 'detour_seconds' => 0],
        ], $desired);
        self::assertSame([1, 2], array_column($cards, 'trip_id'));
        self::assertArrayNotHasKey('_ranking_key', $cards[0]);
    }

    public function testTiesHaveStableTripIdOrderAndNoInventedOverlapScore(): void
    {
        $desired = CarbonImmutable::parse('2026-10-28 08:30:00', 'Asia/Kolkata');
        $cards = CommuteMatchingService::rankCards([
            ['trip_id' => 30, 'departure_at' => '2026-10-28T03:00:00.000Z'],
            ['trip_id' => 12, 'departure_at' => '2026-10-28T03:00:00.000Z'],
        ], $desired);

        self::assertSame([12, 30], array_column($cards, 'trip_id'));
        self::assertNotContains('route_overlap', $cards[0]['ranking_basis']);
    }
}
