<?php

namespace Launchpad\Common\Tests\Unit;

use Launchpad\Common\Messaging\Message\DocumentDecided;
use Launchpad\Common\Messaging\Message\WorkspaceStatusChanged;
use PHPUnit\Framework\TestCase;

/**
 * Les DTO échangés via RabbitMQ doivent survivre à l'aller-retour JSON producteur → consommateur.
 */
final class QueueMessageTest extends TestCase
{
    public function testWorkspaceStatusChangedRoundTrip(): void
    {
        $message = new WorkspaceStatusChanged('019a1000-0000-7000-8000-000000000001', false, 'Espace comptable désactivé', 'admin-sub', '2026-11-06T10:00:00+00:00');

        $decoded = WorkspaceStatusChanged::fromArray(json_decode(json_encode($message->toArray(), \JSON_THROW_ON_ERROR), true));

        self::assertEquals($message, $decoded);
    }

    public function testDocumentDecidedRoundTripKeepsAccentsAndNullComment(): void
    {
        $message = new DocumentDecided('doc', 'file', 'Relevé bancaire — mars 2026', 2, DocumentDecided::VALIDATED, null, true, 'sonia', '2026-11-06T10:00:00+00:00');

        $json = json_encode($message->toArray(), \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_UNICODE);
        $decoded = DocumentDecided::fromArray(json_decode($json, true));

        self::assertStringContainsString('Relevé bancaire — mars 2026', $json);
        self::assertEquals($message, $decoded);
        self::assertNull($decoded->comment);
    }

    public function testOptionalFieldsHaveDefaults(): void
    {
        $decoded = WorkspaceStatusChanged::fromArray(['workspaceId' => 'w', 'active' => true, 'reason' => 'r']);

        self::assertSame('', $decoded->changedBy);
        self::assertTrue($decoded->active);
    }
}
