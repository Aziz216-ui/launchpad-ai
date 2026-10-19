<?php

namespace App\Http\Pagination;

use App\Exception\ApiException;
use Doctrine\ORM\QueryBuilder;
use Doctrine\ORM\Tools\Pagination\Paginator as DoctrinePaginator;
use Symfony\Component\HttpFoundation\Request;

/**
 * Pagination simple par ?page=1&limit=20 (limit plafonné à 100).
 */
final class Paginator
{
    public const DEFAULT_LIMIT = 20;
    public const MAX_LIMIT = 100;

    public function __construct(private readonly PaginationFormatterInterface $formatter)
    {
    }

    /**
     * @template T of object
     *
     * @param callable(T): array<string, mixed> $present transforme une entité en tableau
     *
     * @return array<string, mixed>
     */
    public function paginate(QueryBuilder $queryBuilder, Request $request, callable $present): array
    {
        $page = $this->positiveInt($request, 'page', 1);
        $limit = min($this->positiveInt($request, 'limit', self::DEFAULT_LIMIT), self::MAX_LIMIT);

        $queryBuilder->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        $paginator = new DoctrinePaginator($queryBuilder, fetchJoinCollection: false);

        $items = array_map($present, iterator_to_array($paginator, false));

        return $this->formatter->format($items, $page, $limit, \count($paginator));
    }

    private function positiveInt(Request $request, string $name, int $default): int
    {
        $raw = $request->query->get($name);
        if (null === $raw || '' === $raw) {
            return $default;
        }

        $value = filter_var($raw, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (false === $value) {
            throw ApiException::invalidField($name, 'Doit être un entier supérieur ou égal à 1.');
        }

        return $value;
    }
}
