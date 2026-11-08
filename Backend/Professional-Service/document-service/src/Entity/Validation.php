<?php

namespace App\Entity;

use App\Enum\DocumentStatus;
use App\Enum\ValidationDecision;
use App\Repository\ValidationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Décision du comptable sur un document. Chaque décision (ou révision) ajoute une ligne :
 * l'historique n'est jamais modifié.
 */
#[ORM\Entity(repositoryClass: ValidationRepository::class)]
#[ORM\Table(name: 'validation')]
class Validation
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private AccountingDocument $document;

    #[ORM\Column(length: 64)]
    private string $accountantId;

    #[ORM\Column(length: 20, enumType: ValidationDecision::class)]
    private ValidationDecision $decision;

    /** Statut du document avant la décision (audit, détection des révisions). */
    #[ORM\Column(length: 20, enumType: DocumentStatus::class)]
    private DocumentStatus $previousStatus;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $comment;

    /** True pour la validation automatique d'un document déposé par le comptable. */
    #[ORM\Column]
    private bool $automatic;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        AccountingDocument $document,
        string $accountantId,
        ValidationDecision $decision,
        DocumentStatus $previousStatus,
        ?string $comment = null,
        bool $automatic = false,
    ) {
        $this->id = Uuid::v7();
        $this->document = $document;
        $this->accountantId = $accountantId;
        $this->decision = $decision;
        $this->previousStatus = $previousStatus;
        $this->comment = $comment;
        $this->automatic = $automatic;
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

    public function getAccountantId(): string
    {
        return $this->accountantId;
    }

    public function getDecision(): ValidationDecision
    {
        return $this->decision;
    }

    public function getPreviousStatus(): DocumentStatus
    {
        return $this->previousStatus;
    }

    public function isRevision(): bool
    {
        return DocumentStatus::PENDING !== $this->previousStatus;
    }

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function isAutomatic(): bool
    {
        return $this->automatic;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
