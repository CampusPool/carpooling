<?php

namespace STS\Mobility\Tracking;

final class TrustedShareException extends \RuntimeException
{
    public function __construct(public string $errorCode, public int $httpStatus = 422)
    {
        parent::__construct($errorCode);
    }
}
