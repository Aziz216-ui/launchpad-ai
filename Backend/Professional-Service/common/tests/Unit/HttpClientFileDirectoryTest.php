<?php

namespace Launchpad\Common\Tests\Unit;

use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Remote\HttpClientFileDirectory;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class HttpClientFileDirectoryTest extends TestCase
{
    private const FILE_ID = '019a2000-0000-7000-8000-000000000001';

    public function testReturnsTheContextSentByClientFileService(): void
    {
        $requests = [];
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests): MockResponse {
            $requests[] = [$method, $url, $options['headers']];

            return new MockResponse(json_encode(['data' => [
                'id' => self::FILE_ID,
                'reference' => 'DOS-2026-000001',
                'status' => 'ACTIVE',
                'entrepreneurId' => 'e1',
                'accountantId' => 'a1',
                'workspaceActive' => false,
            ]]));
        }, 'http://client-file.test');
        $directory = new HttpClientFileDirectory($client);

        $context = $directory->context(self::FILE_ID);

        self::assertSame('DOS-2026-000001', $context?->reference);
        self::assertTrue($context->isActive());
        self::assertFalse($context->workspaceActive);
        self::assertSame(['GET', 'http://client-file.test/internal/files/'.self::FILE_ID], [$requests[0][0], $requests[0][1]]);

        // Contexte mis en cache pour la requête en cours (plusieurs voters le consultent)
        $directory->context(self::FILE_ID);
        self::assertCount(1, $requests);
    }

    public function testUnknownFileReturnsNull(): void
    {
        $directory = new HttpClientFileDirectory(new MockHttpClient(new MockResponse('{}', ['http_code' => 404]), 'http://client-file.test'));

        self::assertNull($directory->context(self::FILE_ID));
    }

    public function testServerErrorBecomesServiceUnavailable(): void
    {
        $directory = new HttpClientFileDirectory(new MockHttpClient(new MockResponse('oops', ['http_code' => 500]), 'http://client-file.test'));

        $this->expectServiceUnavailable(fn () => $directory->context(self::FILE_ID));
    }

    public function testUnreachableServiceBecomesServiceUnavailable(): void
    {
        $client = new MockHttpClient(fn () => throw new TransportException('Connexion refusée'), 'http://client-file.test');
        $directory = new HttpClientFileDirectory($client);

        $this->expectServiceUnavailable(fn () => $directory->context(self::FILE_ID));
    }

    private function expectServiceUnavailable(callable $call): void
    {
        try {
            $call();
            self::fail('Une ApiException 503 était attendue.');
        } catch (ApiException $exception) {
            self::assertSame(503, $exception->getStatusCode());
            self::assertSame('SERVICE_UNAVAILABLE', $exception->getErrorCode());
        }
    }
}
