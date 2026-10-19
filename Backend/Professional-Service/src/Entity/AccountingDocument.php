<?php

namespace App\Entity;

use App\Enum\DocumentSource;
use App\Enum\DocumentStatus;
use App\Enum\DocumentType;
use App\Enum\UserRole;
use App\Repository\AccountingDocumentRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Document comptable d'un dossier : fichier déposé (UPLOAD) ou référence externe (EXTERNAL).
 * Jamais supprimé physiquement (soft delete via deletedAt).
 */
#[ORM\Entity(repositoryClass: AccountingDocumentRepository::class)]
#[ORM\Table(name: 'accounting_document')]
#[ORM\Index(name: 'idx_document_status', columns: ['status'])]
#[ORM\HasLifecycleCallbacks]
class AccountingDocument
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ClientFile $clientFile;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(length: 30, enumType: DocumentType::class)]
    private DocumentType $type;

    #[ORM\Column(length: 10, enumType: DocumentSource::class)]
    private DocumentSource $source;

    // --- Champs UPLOAD -------------------------------------------------

    /** Clé renvoyée par DocumentStorageInterface (jamais un chemin public). */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $storageKey = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $originalFilename = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $mimeType = null;

    #[ORM\Column(nullable: true)]
    private ?int $size = null;

    /** Empreinte SHA-256 du fichier. */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $checksum = null;

    // --- Champs EXTERNAL -----------------------------------------------

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $externalRef = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $externalService = null;

    // -------------------------------------------------------------------

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $periodStart = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $periodEnd = null;

    #[ORM\Column(length: 20, enumType: DocumentStatus::class)]
    private DocumentStatus $status = DocumentStatus::PENDING;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $versionNumber = 1;

    /** Version précédente (rejetée) que ce document remplace. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true)]
    private ?AccountingDocument $previousVersion = null;

    #[ORM\Column(length: 64)]
    private string $uploadedBy;

    #[ORM\Column(length: 20, enumType: UserRole::class)]
    private UserRole $uploadedByRole;

    #[ORM\Column]
    private \DateTimeImmutable $uploadedAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    private function __construct(
        ClientFile $clientFile,
        string $title,
        DocumentType $type,
        DocumentSource $source,
        string $uploadedBy,
        UserRole $uploadedByRole,
    ) {
        $this->id = Uuid::v7();
        $this->clientFile = $clientFile;
        $this->title = $title;
        $this->type = $type;
        $this->source = $source;
        $this->uploadedBy = $uploadedBy;
        $this->uploadedByRole = $uploadedByRole;
        $this->uploadedAt = new \DateTimeImmutable();
        $this->updatedAt = $this->uploadedAt;
    }

    public static function uploaded(
        ClientFile $clientFile,
        string $title,
        DocumentType $type,
        string $uploadedBy,
        UserRole $uploadedByRole,
        string $storageKey,
        string $originalFilename,
        string $mimeType,
        int $size,
        string $checksum,
    ): self {
        $document = new self($clientFile, $title, $type, DocumentSource::UPLOAD, $uploadedBy, $uploadedByRole);
        $document->storageKey = $storageKey;
        $document->originalFilename = $originalFilename;
        $document->mimeType = $mimeType;
        $document->size = $size;
        $document->checksum = $checksum;

        return $document;
    }

    public static function external(
        ClientFile $clientFile,
        string $title,
        DocumentType $type,
        string $uploadedBy,
        UserRole $uploadedByRole,
        string $externalRef,
        string $externalService,
    ): self {
        $document = new self($clientFile, $title, $type, DocumentSource::EXTERNAL, $uploadedBy, $uploadedByRole);
        $document->externalRef = $externalRef;
        $document->externalService = $externalService;

        return $document;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function setPeriod(?\DateTimeImmutable $start, ?\DateTimeImmutable $end): void
    {
        $this->periodStart = $start;
        $this->periodEnd = $end;
    }

    /** Fait de ce document la version suivante de $previous. */
    public function replaces(self $previous): void
    {
        $this->previousVersion = $previous;
        $this->versionNumber = $previous->getVersionNumber() + 1;
    }

    public function changeStatus(DocumentStatus $status): void
    {
        $this->status = $status;
    }

    public function softDelete(): void
    {
        $this->deletedAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getClientFile(): ClientFile
    {
        return $this->clientFile;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getType(): DocumentType
    {
        return $this->type;
    }

    public function getSource(): DocumentSource
    {
        return $this->source;
    }

    public function getStorageKey(): ?string
    {
        return $this->storageKey;
    }

    public function getOriginalFilename(): ?string
    {
        return $this->originalFilename;
    }

    public function getMimeType(): ?string
    {
        return $this->mimeType;
    }

    public function getSize(): ?int
    {
        return $this->size;
    }

    public function getChecksum(): ?string
    {
        return $this->checksum;
    }

    public function getExternalRef(): ?string
    {
        return $this->externalRef;
    }

    public function getExternalService(): ?string
    {
        return $this->externalService;
    }

    public function getPeriodStart(): ?\DateTimeImmutable
    {
        return $this->periodStart;
    }

    public function getPeriodEnd(): ?\DateTimeImmutable
    {
        return $this->periodEnd;
    }

    public function getStatus(): DocumentStatus
    {
        return $this->status;
    }

    public function getVersionNumber(): int
    {
        return $this->versionNumber;
    }

    public function getPreviousVersion(): ?self
    {
        return $this->previousVersion;
    }

    public function getUploadedBy(): string
    {
        return $this->uploadedBy;
    }

    public function getUploadedByRole(): UserRole
    {
        return $this->uploadedByRole;
    }

    public function getUploadedAt(): \DateTimeImmutable
    {
        return $this->uploadedAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function isDeleted(): bool
    {
        return null !== $this->deletedAt;
    }
}
