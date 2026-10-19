<?php

namespace App\Http;

use App\Exception\ApiException;
use Symfony\Component\HttpFoundation\Request;

/**
 * Lecture validée des filtres passés en query string.
 */
final class QueryParams
{
    /**
     * @template T of \BackedEnum
     *
     * @param class-string<T> $enum
     *
     * @return T|null
     */
    public static function enum(Request $request, string $name, string $enum): ?\BackedEnum
    {
        $raw = $request->query->getString($name);
        if ('' === $raw) {
            return null;
        }

        return $enum::tryFrom($raw)
            ?? throw ApiException::invalidField($name, sprintf('Valeurs possibles : %s.', implode(', ', array_column($enum::cases(), 'value'))));
    }
}
