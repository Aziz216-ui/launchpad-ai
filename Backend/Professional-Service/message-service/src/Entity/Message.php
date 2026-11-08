<?php

namespace App\Entity;

use App\Repository\MessageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Launchpad\Common\Enum\UserRole;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Message échangé entre l'entrepreneur et le comptable dans le fil d'un dossier.
 */
#[ORM\Entity(repositoryClass: MessageRepository::class)]
#[ORM\Table(name: 'message')]
#[ORM\Index(name: 'idx_message_client_file', columns: ['client_file_id'])]
class Message
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    /** Dossier client (géré par client-file-service : pas de clé étrangère). */
    #[ORM\Column(type: UuidType::NAME)]
    private Uuid $clientFileId;

    /** Document concerné par le message (facultatif, géré par document-service). */
    #[ORM\Column(type: UuidType::NAME, nullable: true)]
    private ?Uuid $documentId;

    #[ORM\Column(length: 64)]
    private string $senderId;

    #[ORM\Column(length: 20, enumType: UserRole::class)]
    private UserRole $senderRole;

    #[ORM\Column(type: Types::TEXT)]
    private string $content;

    /** Notification générée par un événement RabbitMQ (ex. décision sur un document), pas écrite à la main. */
    #[ORM\Column(options: ['default' => false])]
    private bool $automatic = false;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $readAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        string $clientFileId,
        string $senderId,
        UserRole $senderRole,
        string $content,
        ?string $documentId = null,
        bool $automatic = false,
    ) {
        $this->automatic = $automatic;
        $this->id = Uuid::v7();
        $this->clientFileId = Uuid::fromString($clientFileId);
        $this->senderId = $senderId;
        $this->senderRole = $senderRole;
        $this->content = $content;
        $this->documentId = null !== $documentId ? Uuid::fromString($documentId) : null;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function markAsRead(): void
    {
        $this->readAt ??= new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getClientFileId(): Uuid
    {
        return $this->clientFileId;
    }

    public function getDocumentId(): ?Uuid
    {
        return $this->documentId;
    }

    public function getSenderId(): string
    {
        return $this->senderId;
    }

    public function getSenderRole(): UserRole
    {
        return $this->senderRole;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function isAutomatic(): bool
    {
        return $this->automatic;
    }

    public function getReadAt(): ?\DateTimeImmutable
    {
        return $this->readAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
