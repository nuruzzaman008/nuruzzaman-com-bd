<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Money is handled as an integer number of minor units (1 BDT = 100 poisha).
 * Nothing in the commerce path may use a float.
 */
final class Money
{
    private function __construct(
        public readonly int $minor,
        public readonly string $currency,
    ) {
        if ($minor < 0) {
            throw new InvalidArgumentException('Money cannot be negative.');
        }
    }

    public static function minor(int $minor, string $currency = 'BDT'): self
    {
        return new self($minor, strtoupper($currency));
    }

    public static function zero(string $currency = 'BDT'): self
    {
        return new self(0, strtoupper($currency));
    }

    public function plus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->minor + $other->minor, $this->currency);
    }

    public function minus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self(max(0, $this->minor - $other->minor), $this->currency);
    }

    public function times(int $factor): self
    {
        return new self($this->minor * $factor, $this->currency);
    }

    /**
     * Percentage discounts round half up on the minor unit so the customer is
     * never charged a fraction of a poisha.
     */
    public function percentage(int $percent): self
    {
        if ($percent < 0 || $percent > 100) {
            throw new InvalidArgumentException('Percentage must be between 0 and 100.');
        }

        return new self(intdiv($this->minor * $percent + 50, 100), $this->currency);
    }

    public function isZero(): bool
    {
        return $this->minor === 0;
    }

    /** Decimal string for gateway payloads that require major units. */
    public function toMajorString(): string
    {
        return number_format($this->minor / 100, 2, '.', '');
    }

    private function assertSameCurrency(self $other): void
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException('Cannot combine different currencies.');
        }
    }
}
