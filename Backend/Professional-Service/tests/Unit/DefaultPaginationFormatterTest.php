<?php

namespace App\Tests\Unit;

use App\Http\Pagination\DefaultPaginationFormatter;
use PHPUnit\Framework\TestCase;

final class DefaultPaginationFormatterTest extends TestCase
{
    public function testFormatsDataAndMeta(): void
    {
        $result = (new DefaultPaginationFormatter())->format([['id' => 1]], page: 2, limit: 20, total: 41);

        self::assertSame([
            'data' => [['id' => 1]],
            'meta' => ['page' => 2, 'limit' => 20, 'total' => 41, 'pages' => 3],
        ], $result);
    }

    public function testEmptyResult(): void
    {
        $result = (new DefaultPaginationFormatter())->format([], page: 1, limit: 20, total: 0);

        self::assertSame(0, $result['meta']['pages']);
    }
}
