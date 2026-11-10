<?php

namespace STS\Mobility\Routing;

final class RouteDataVersion
{
    /** OSRM graph hashes and Ola API-contract identity are distinct sources of truth. */
    public static function valid(mixed $value, string $mode): bool
    {
        return self::validForProvider($value, $mode, 'osrm') || self::validForProvider($value, $mode, 'ola');
    }

    public static function validForProvider(mixed $value, string $mode, mixed $provider): bool
    {
        if (! is_string($value) || ! in_array($mode, ['car', 'bike', 'foot'], true)) return false;
        if ($provider === 'ola') return hash_equals('ola-directions-v1:'.$mode, $value);
        if ($provider !== 'osrm') return false;
        return preg_match('/^'.preg_quote($mode, '/').'\|crop_sha256=[a-f0-9]{64}\|profile_sha256=[a-f0-9]{64}$/D', $value) === 1;
    }

    public static function validAny(mixed $value, mixed $provider): bool
    {
        foreach (['car', 'bike', 'foot'] as $mode) if (self::validForProvider($value, $mode, $provider)) return true;
        return false;
    }

    public static function expected(string $mode): ?string
    {
        if (! in_array($mode, ['car', 'bike', 'foot'], true)) return null;
        if (config('mobility_routing.provider') === 'ola') return 'ola-directions-v1:'.$mode;
        return config('mobility_routing.'.$mode.'_expected_data_version');
    }

    public static function allowed(mixed $value, string $mode, bool $synthetic): bool
    {
        return $value === null ? $synthetic : self::valid($value, $mode);
    }
}
