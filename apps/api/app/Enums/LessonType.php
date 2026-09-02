<?php

namespace App\Enums;

enum LessonType: string
{
    case Text = 'text';
    case Video = 'video';
    case Download = 'download';
    case Quiz = 'quiz';
    case Assignment = 'assignment';

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
