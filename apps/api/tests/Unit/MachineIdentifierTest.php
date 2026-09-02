<?php

namespace Tests\Unit;

use App\Support\MachineIdentifier;
use PHPUnit\Framework\TestCase;

class MachineIdentifierTest extends TestCase
{
    public function test_it_masks_everything_but_the_first_and_last_four_characters(): void
    {
        $masked = MachineIdentifier::mask('A1B2-C3D4-E5F6-9F3C');

        $this->assertStringStartsWith('A1B2', $masked);
        $this->assertStringEndsWith('9F3C', $masked);
        $this->assertStringNotContainsString('C3D4', $masked);
    }

    public function test_short_identifiers_are_fully_masked(): void
    {
        $this->assertSame('********', MachineIdentifier::mask('ABC-12345'));
    }

    public function test_normalisation_ignores_separators_and_case(): void
    {
        $this->assertSame(
            MachineIdentifier::normalize('a1b2-c3d4'),
            MachineIdentifier::normalize('A1B2 C3D4'),
        );
    }
}
