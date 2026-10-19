<?php

namespace App\Entity;

use App\Enum\DocumentEventType;
use App\Enum\UserRole;
use App\Repository\DocumentEventRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Trace d'un événement sur un document (ex. suppression logique).
 */
#[ORM\Entity(repositoryClass: DocumentEventRepository::class)]
#[ORM\Table(name: 'document_event')]
class DocumentEvent
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private AccountingDocument $document;

    #[ORM\Column(length: 30, enumType: DocumentEventType::class)]
    private DocumentEventType $type;

    #[ORM\Column(length: 64)]
    private string $actorId;

    #[ORM\Column(length: 20, enumType: UserRole::class)]
    private UserRole $actorRole;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $comment;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        AccountingDocument $document,
        DocumentEventType $type,
        string $actorId,
        UserRole $actorRole,
        ?string $comment = null,
    ) {
        $this->id = Uuid::v7();
        $this->document = $document;
        $this->type = $type;
        $this->actorId = $actorId;
        $this->actorRole = $actorRole;
        $this->comment = $comment;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getDocument(): AccountingDocument
    {
        return $this->document;
    }

    public function getType(): DocumentEventType
    {
        return $this->type;
    }

    public function getActorId(): string
    {
        return $this->actorId;
    }

    public function getActorRole(): UserRole
    {
        return $this->actorRole;
    }

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
