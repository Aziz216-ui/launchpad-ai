<?php

namespace App\Tests\Functional;

final class ApiDocTest extends ApiTestCase
{
    public function testSwaggerUiIsPublic(): void
    {
        $this->client->request('GET', self::PREFIX.'/docs');

        $this->assertStatus(200);
        self::assertStringContainsString('text/html', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertStringContainsString('/api/comptable/docs.json', $this->client->getResponse()->getContent());
    }

    public function testOpenApiSpecDescribesTheApi(): void
    {
        $spec = $this->request('GET', '/docs.json');

        $this->assertStatus(200);
        self::assertStringStartsWith('3.', $spec['openapi']);
        self::assertSame('bearer', $spec['components']['securitySchemes']['Bearer']['scheme']);

        // Routes publiques de ce service uniquement : ni la documentation, ni les routes /internal
        self::assertArrayHasKey('/api/comptable/workspaces', $spec['paths']);
        self::assertArrayHasKey('/api/comptable/me', $spec['paths']);
        self::assertArrayNotHasKey('/api/comptable/docs', $spec['paths']);
        self::assertArrayNotHasKey('/internal/workspaces/{id}', $spec['paths']);

        $list = $spec['paths']['/api/comptable/workspaces']['get'];
        self::assertContains('limit', array_column($list['parameters'], 'name'));
        self::assertSame([], $spec['paths']['/api/comptable/health']['get']['security']);
    }
}
