<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * A business rule was violated. Carries the HTTP status the API should return
 * so controllers never have to translate domain failures by hand.
 */
class DomainException extends HttpException
{
    public function __construct(string $message, int $status = 422)
    {
        parent::__construct($status, $message);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }

    public static function forbidden(string $message): self
    {
        return new self($message, 403);
    }

    public static function unavailable(string $message): self
    {
        return new self($message, 503);
    }
}
