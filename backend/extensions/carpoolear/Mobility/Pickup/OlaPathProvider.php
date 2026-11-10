<?php

namespace STS\Mobility\Pickup;

use STS\Mobility\Routing\OlaDirectionsClient;

/** Detailed routing adapter for pickup and walking geometry. Not wired yet. */
final class OlaPathProvider implements PathProvider
{
    public function __construct(private readonly OlaDirectionsClient $client) {}

    public function path(array $points, string $mode, float $timeoutSeconds = 5): array
    {
        return $this->client->directions($points, $mode, $timeoutSeconds);
    }
}
