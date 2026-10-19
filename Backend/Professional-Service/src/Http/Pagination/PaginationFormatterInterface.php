<?php

namespace App\Http\Pagination;

/**
 * Mise en forme d'une page de résultats. Remplacer l'implémentation
 * (config/services.yaml) suffit pour adopter un format commun à l'équipe.
 */
interface PaginationFormatterInterface
{
    /**
     * @param list<array<string, mixed>> $items
     *
     * @return array<string, mixed>
     */
    public function format(array $items, int $page, int $limit, int $total): array;
}
