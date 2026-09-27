<?php

namespace App\Services\Growth;

interface AIProviderInterface
{
    /** @return array{text:string,input_tokens:?int,output_tokens:?int} */
    public function chat(object $provider, array $messages): array;
}
