<?php

namespace App\Entity;

use App\Enum\ClientFileStatus;
use App\Repository\ClientFileRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Dossier client : suivi d'une startup par un comptable.
 */
#[ORM\Entity(repositoryClass: ClientFileRepository::class)]
#[ORM\Table(name: 'client_file')]
#[ORM\Index(name: 'idx_client_file_entrepreneur', columns: ['entrepreneur_id'])]
#[ORM\Index(name: 'idx_client_file_status', columns: ['status'])]
#[ORM\HasLifecycleCallbacks]
class ClientFile
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    /** Référence lisible, ex. DOS-2026-000123. */
    #[ORM\Column(length: 20, unique: true)]
    private string $reference;

    /** Comptable actuellement visé / affecté. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private AccountantWorkspace $workspace;

    #[ORM\Column(length: 64)]
    private string $entrepreneurId;

    #[ORM\Column(length: 150, nullable: true)]
    private ?string $entrepreneurDisplayName;

    /** Identifiant du projet dans un autre service (facultatif). */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $startupId;

    #[ORM\Column(length: 150)]
    private string $startupName;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $requestMessage;

    #[ORM\Column(length: 20, enumType: ClientFileStatus::class)]
    private ClientFileStatus $status = ClientFileStatus::PENDING;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $rejectionReason = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $decidedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $closedAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        string $reference,
        AccountantWorkspace $workspace,
        string $entrepreneurId,
        string $startupName,
        ?string $startupId = null,
        ?string $requestMessage = null,
        ?string $entrepreneurDisplayName = null,
    ) {
        $this->id = Uuid::v7();
        $this->reference = $reference;
        $this->workspace = $workspace;
        $this->entrepreneurId = $entrepreneurId;
        $this->startupName = $startupName;
        $this->startupId = $startupId;
        $this->requestMessage = $requestMessage;
        $this->entrepreneurDisplayName = $entrepreneurDisplayName;
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    /** Demande acceptée par le comptable ou affectée par un administrateur. */
    public function activate(): void
    {
        $this->status = ClientFileStatus::ACTIVE;
        $this->decidedAt = new \DateTimeImmutable();
    }

    public function reject(string $reason): void
    {
        $this->status = ClientFileStatus::REJECTED;
        $this->rejectionReason = $reason;
        $this->decidedAt = new \DateTimeImmutable();
    }

    public function close(): void
    {
        $this->status = ClientFileStatus::CLOSED;
        $this->closedAt = new \DateTimeImmutable();
    }

    public function assignTo(AccountantWorkspace $workspace): void
    {
        $this->workspace = $workspace;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getReference(): string
    {
        return $this->reference;
    }

    public function getWorkspace(): AccountantWorkspace
    {
        return $this->workspace;
    }

    public function getEntrepreneurId(): string
    {
        return $this->entrepreneurId;
    }

    public function getEntrepreneurDisplayName(): ?string
    {
        return $this->entrepreneurDisplayName;
    }

    public function getStartupId(): ?string
    {
        return $this->startupId;
    }

    public function setStartupId(?string $startupId): void
    {
        $this->startupId = $startupId;
    }

    public function getStartupName(): string
    {
        return $this->startupName;
    }

    public function setStartupName(string $startupName): void
    {
        $this->startupName = $startupName;
    }

    public function getRequestMessage(): ?string
    {
        return $this->requestMessage;
    }

    public function setRequestMessage(?string $requestMessage): void
    {
        $this->requestMessage = $requestMessage;
    }

    public function getStatus(): ClientFileStatus
    {
        return $this->status;
    }

    public function getRejectionReason(): ?string
    {
        return $this->rejectionReason;
    }

    public function getDecidedAt(): ?\DateTimeImmutable
    {
        return $this->decidedAt;
    }

    public function getClosedAt(): ?\DateTimeImmutable
    {
        return $this->closedAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
