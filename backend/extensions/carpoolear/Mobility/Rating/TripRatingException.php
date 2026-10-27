<?php
namespace STS\Mobility\Rating;
final class TripRatingException extends \RuntimeException {
 public function __construct(public readonly string $errorCode, public readonly int $httpStatus = 422) { parent::__construct($errorCode); }
}
