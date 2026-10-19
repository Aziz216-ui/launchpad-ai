<?php

namespace App\Entity;

use App\Enum\UserRole;
use App\Repository\MessageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Message échangé entre l'entrepreneur et le comptable dans le fil d'un dossier.
 */
#[ORM\Entity(repositoryClass: MessageRepository::class)]
#[ORM\Table(name: 'message')]
class Message
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ClientFile $clientFile;

    /** Document concerné par le message (facultatif). */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?AccountingDocument $document;

    #[ORM\Column(length: 64)]
    private string $senderId;

    #[ORM\Column(length: 20, enumType: UserRole::class)]
    private UserRole $senderRole;

    #[ORM\Column(type: Types::TEXT)]
    private string $content;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $readAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        ClientFile $clientFile,
        string $senderId,
        UserRole $senderRole,
        string $content,
        ?AccountingDocument $document = null,
    ) {
        $this->id = Uuid::v7();
        $this->clientFile = $clientFile;
        $this->senderId = $senderId;
        $this->senderRole = $senderRole;
        $this->content = $content;
        $this->document = $document;
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

    public function getClientFile(): ClientFile
    {
        return $this->clientFile;
    }

    public function getDocument(): ?AccountingDocument
    {
        return $this->document;
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

    public function getReadAt(): ?\DateTimeImmutable
    {
        return $this->readAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
