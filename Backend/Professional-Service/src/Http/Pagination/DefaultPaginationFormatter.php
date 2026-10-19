<?php

namespace App\Http\Pagination;

/**
 * {"data": [...], "meta": {"page", "limit", "total", "pages"}}
 */
final class DefaultPaginationFormatter implements PaginationFormatterInterface
{
    public function format(array $items, int $page, int $limit, int $total): array
    {
        return [
            'data' => $items,
            'meta' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => (int) ceil($total / $limit),
            ],
        ];
    }
}
